-- Remove every demo "@omnios.local" account and the rows tied to its user id.
--
-- Rows that cascade on user delete (sessions, notifications, recordings, login
-- events, time logs, chat messages, ...) go with the user. Business records
-- that block the delete (deals, candidates, projects, activities, call logs,
-- manager links, ...) are first reassigned to a real admin. The FK columns are
-- discovered from pg_constraint so no table is missed.
--
-- Never raises: docker-entrypoint.sh falls back to `prisma db push
-- --accept-data-loss` if `migrate deploy` fails, so a failed step here only
-- logs a WARNING and leaves the affected rows untouched.
DO $$
DECLARE
  target_ids text[];
  admin_id   text;
  fk         record;
  moved      bigint;
  removed    bigint;
BEGIN
  SELECT array_agg("id"::text) INTO target_ids
  FROM "User"
  WHERE LOWER("email") LIKE '%@omnios.local';

  IF target_ids IS NULL THEN
    RAISE NOTICE 'omnios.local cleanup: no matching users, nothing to do';
    RETURN;
  END IF;

  SELECT "id"::text INTO admin_id
  FROM "User"
  WHERE LOWER("email") IN ('jivan@venushiring.com', 'paresh@venusglobaltech.com', 'megan@venushiring.ca')
    AND NOT ("id"::text = ANY (target_ids))
  ORDER BY CASE LOWER("email")
    WHEN 'jivan@venushiring.com' THEN 1
    WHEN 'paresh@venusglobaltech.com' THEN 2
    ELSE 3
  END
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE WARNING 'omnios.local cleanup: no admin to reassign records to, skipping';
    RETURN;
  END IF;

  -- Reassign every non-cascading single-column FK that points at "User".
  FOR fk IN
    SELECT con.conrelid::regclass::text AS tbl, att.attname AS col
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = '"User"'::regclass
      AND array_length(con.conkey, 1) = 1
      AND con.confdeltype IN ('a', 'r')
  LOOP
    BEGIN
      EXECUTE format(
        'UPDATE %s SET %I = %L WHERE %I::text = ANY (%L::text[])',
        fk.tbl, fk.col, admin_id, fk.col, target_ids
      );
      GET DIAGNOSTICS moved = ROW_COUNT;
      IF moved > 0 THEN
        RAISE NOTICE 'omnios.local cleanup: reassigned % row(s) in %.%', moved, fk.tbl, fk.col;
      END IF;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'omnios.local cleanup: could not reassign %.% (%)', fk.tbl, fk.col, SQLERRM;
    END;
  END LOOP;

  BEGIN
    DELETE FROM "User" WHERE "id"::text = ANY (target_ids);
    GET DIAGNOSTICS removed = ROW_COUNT;
    RAISE NOTICE 'omnios.local cleanup: deleted % user(s)', removed;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'omnios.local cleanup: could not delete users (%)', SQLERRM;
  END;
END $$;
