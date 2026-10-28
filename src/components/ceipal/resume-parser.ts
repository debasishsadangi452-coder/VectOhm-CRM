/**
 * Intelligent Resume Parser & Information Extractor
 * Extracts candidate credentials (Name, Email, Phone, Location, Job Title,
 * Qualifications/Degrees, Institution, Experience, Skills, Certifications, Summary)
 * from PDF (with FlateDecode stream decompression), DOCX (via XML parsing),
 * TXT, and RTF resume documents.
 */

import { decompressSync, unzlibSync, unzipSync, strFromU8 } from 'fflate';
import pako from 'pako';

export interface ExtractedResumeData {
  name?: string;
  email?: string;
  mobile?: string;
  city?: string;
  state?: string;
  jobTitle?: string;
  summary?: string;
  skills?: string[];
  totalExperience?: string;
  educationDegree?: string;
  educationInstitution?: string;
  educationYear?: string;
  certifications?: string[];
  rawText?: string;
}

// -------------------------------------------------------------
// Known Technology and Domain Skills Dictionary (100+ keywords)
// -------------------------------------------------------------
const TECH_SKILLS = [
  // Programming Languages
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'C++',
  'C#',
  '.NET',
  'ASP.NET',
  'Golang',
  'Go',
  'Rust',
  'PHP',
  'Ruby',
  'Ruby on Rails',
  'Swift',
  'Kotlin',
  'Dart',
  'Scala',
  'R',
  'Bash',
  'Shell',
  'PowerShell',
  'Perl',

  // Frontend & UI
  'React',
  'React.js',
  'React Native',
  'Next.js',
  'Vue.js',
  'Vue',
  'Angular',
  'Svelte',
  'Redux',
  'Zustand',
  'Tailwind CSS',
  'Tailwind',
  'HTML5',
  'HTML',
  'CSS3',
  'CSS',
  'Sass',
  'SCSS',
  'Bootstrap',
  'Material-UI',
  'Webpack',
  'Vite',

  // Backend & APIs
  'Node.js',
  'Node',
  'Express.js',
  'Express',
  'NestJS',
  'Django',
  'Flask',
  'FastAPI',
  'Spring Boot',
  'Spring',
  'Laravel',
  'GraphQL',
  'REST APIs',
  'RESTful API',
  'REST API',
  'Microservices',
  'gRPC',
  'WebSockets',

  // Databases & Caches
  'SQL',
  'PostgreSQL',
  'Postgres',
  'MySQL',
  'MongoDB',
  'Redis',
  'Cassandra',
  'DynamoDB',
  'Oracle',
  'SQLite',
  'Elasticsearch',
  'Prisma',
  'TypeORM',
  'Hibernate',

  // Cloud & DevOps
  'AWS',
  'Amazon Web Services',
  'Azure',
  'Microsoft Azure',
  'Google Cloud',
  'GCP',
  'Docker',
  'Kubernetes',
  'K8s',
  'Terraform',
  'Ansible',
  'CI/CD',
  'Jenkins',
  'Git',
  'GitHub',
  'GitLab',
  'GitHub Actions',
  'Linux',
  'Nginx',
  'Apache',
  'Helm',
  'Prometheus',
  'Grafana',

  // Messaging, Data & AI
  'Kafka',
  'RabbitMQ',
  'Snowflake',
  'Databricks',
  'Apache Spark',
  'Spark',
  'Hadoop',
  'TensorFlow',
  'PyTorch',
  'Pandas',
  'NumPy',
  'Scikit-learn',
  'Machine Learning',
  'Deep Learning',
  'LLMs',
  'NLP',

  // Testing, Methodologies & Tools
  'Jest',
  'Cypress',
  'Playwright',
  'Selenium',
  'Postman',
  'Swagger',
  'Agile',
  'Scrum',
  'Jira',
  'System Design',
];

// Common Job Titles
const COMMON_TITLES = [
  'Senior Full Stack Engineer',
  'Full Stack Engineer',
  'Full Stack Developer',
  'Lead Software Engineer',
  'Senior Software Engineer',
  'Staff Software Engineer',
  'Software Engineer',
  'Senior Frontend Engineer',
  'Frontend Developer',
  'Frontend Engineer',
  'Senior Backend Engineer',
  'Backend Developer',
  'Backend Engineer',
  'DevOps Engineer',
  'Cloud Solutions Architect',
  'Cloud Architect',
  'Cloud Engineer',
  'Solutions Architect',
  'Data Engineer',
  'Senior Data Engineer',
  'Data Scientist',
  'Machine Learning Engineer',
  'AI Engineer',
  'Technical Lead',
  'Engineering Manager',
  'Product Manager',
  'Project Manager',
  'Scrum Master',
  'QA Automation Engineer',
  'QA Engineer',
  'UI/UX Designer',
  'Database Administrator',
  'Security Engineer',
  'Business Analyst',
];

// Common Locations (US, Canada, India, Global Tech Hubs)
const LOCATION_PATTERNS = [
  // Canada
  { full: 'Ontario', code: 'ON', city: 'Toronto' },
  { full: 'British Columbia', code: 'BC', city: 'Vancouver' },
  { full: 'Quebec', code: 'QC', city: 'Montreal' },
  { full: 'Alberta', code: 'AB', city: 'Calgary' },
  // US
  { full: 'California', code: 'CA', city: 'San Francisco' },
  { full: 'New York', code: 'NY', city: 'New York' },
  { full: 'Texas', code: 'TX', city: 'Austin' },
  { full: 'Washington', code: 'WA', city: 'Seattle' },
  { full: 'Illinois', code: 'IL', city: 'Chicago' },
  { full: 'Massachusetts', code: 'MA', city: 'Boston' },
  { full: 'Georgia', code: 'GA', city: 'Atlanta' },
  { full: 'Florida', code: 'FL', city: 'Miami' },
  { full: 'Colorado', code: 'CO', city: 'Denver' },
  { full: 'North Carolina', code: 'NC', city: 'Raleigh' },
  { full: 'Virginia', code: 'VA', city: 'Richmond' },
  { full: 'New Jersey', code: 'NJ', city: 'Jersey City' },
  // India
  { full: 'Odisha', code: 'OD', city: 'Bhubaneswar' },
  { full: 'Karnataka', code: 'KA', city: 'Bengaluru' },
  { full: 'Telangana', code: 'TS', city: 'Hyderabad' },
  { full: 'Maharashtra', code: 'MH', city: 'Pune' },
  { full: 'Delhi', code: 'DL', city: 'New Delhi' },
  { full: 'Haryana', code: 'HR', city: 'Gurugram' },
  { full: 'Uttar Pradesh', code: 'UP', city: 'Noida' },
  { full: 'Tamil Nadu', code: 'TN', city: 'Chennai' },
  { full: 'West Bengal', code: 'WB', city: 'Kolkata' },
];

const COMMON_CITIES = [
  // North America
  'Toronto',
  'Vancouver',
  'Montreal',
  'Ottawa',
  'Calgary',
  'Waterloo',
  'New York',
  'San Francisco',
  'Seattle',
  'Austin',
  'Chicago',
  'Boston',
  'Los Angeles',
  'Dallas',
  'Atlanta',
  'Denver',
  'San Jose',
  'Houston',
  'San Diego',
  // India
  'Bengaluru',
  'Bangalore',
  'Hyderabad',
  'Pune',
  'Mumbai',
  'Delhi',
  'Gurugram',
  'Gurgaon',
  'Noida',
  'Chennai',
  'Kolkata',
  'Bhubaneswar',
  'Ahmedabad',
  'Jaipur',
  'Kochi',
  'Chandigarh',
  // International
  'London',
  'Berlin',
  'Singapore',
  'Dubai',
  'Sydney',
];

// -------------------------------------------------------------
// 1. Text Extraction from File (PDF, DOCX, TXT, RTF)
// -------------------------------------------------------------

/**
 * Extracts raw readable text from an uploaded File object.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  // 1. Plain text / Markdown / CSV
  if (
    file.type.startsWith('text/') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.csv')
  ) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsText(file);
    });
  }

  // 2. Rich Text Format (.rtf)
  if (fileName.endsWith('.rtf')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = (reader.result as string) || '';
        const clean = raw
          .replace(/\\par[d]?/g, '\n')
          .replace(/\{\\*?\\[^{}]+;\}|[{}]|\\\w+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        resolve(clean);
      };
      reader.onerror = () => resolve('');
      reader.readAsText(file);
    });
  }

  // 3. Word Document (.docx)
  if (
    fileName.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    try {
      const buffer = await file.arrayBuffer();
      const text = extractTextFromDocxBuffer(buffer);
      if (text && text.trim().length > 20) {
        return text;
      }
    } catch (e) {
      console.warn('Docx extraction fallback error:', e);
    }
  }

  // 4. PDF Document (.pdf)
  if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
    try {
      const buffer = await file.arrayBuffer();

      // Attempt A: Industry-standard PDF.js (decodes all CMaps, font glyphs, kerning, layout)
      if (typeof window !== 'undefined') {
        try {
          const pdfjsText = await extractTextWithPdfJs(buffer);
          if (pdfjsText && pdfjsText.trim().length > 15) {
            console.log('[ResumeParser] PDF.js extracted text length:', pdfjsText.length);
            return pdfjsText;
          }
        } catch (pdfjsErr) {
          console.warn('[ResumeParser] PDF.js extraction attempt failed, using fallback:', pdfjsErr);
        }
      }

      // Attempt B: Built-in in-memory Flate stream parser fallback
      const text = await extractTextFromPdfBuffer(buffer);
      if (text && text.trim().length > 15) {
        return text;
      }
    } catch (e) {
      console.warn('PDF extraction fallback error:', e);
    }
  }

  // Fallback: Read as text/ASCII
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = (reader.result as string) || '';
      const asciiOnly = content.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      resolve(asciiOnly);
    };
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

/**
 * Extracts text from a .docx buffer by unzipping the OOXML package and
 * stripping tags out of word/document.xml (docx is a zip of XML parts).
 */
function extractTextFromDocxBuffer(buffer: ArrayBuffer): string {
  const zip = unzipSync(new Uint8Array(buffer));
  const documentXml = zip['word/document.xml'];
  if (!documentXml) return '';

  const xml = strFromU8(documentXml);
  return xml
    // Word represents a line break as <w:br/> or a new paragraph as
    // </w:p> -- turn both into newlines before stripping tags, otherwise
    // every paragraph in the resume collapses onto a single line.
    .replace(/<w:p\b[^>]*>/g, '\n')
    .replace(/<w:br\s*\/?>/g, '\n')
    .replace(/<w:tab\s*\/?>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts layout-preserved text from PDF buffer using Mozilla PDF.js.
 */
async function extractTextWithPdfJs(buffer: ArrayBuffer): Promise<string> {
  const win = typeof window !== 'undefined' ? (window as any) : null;
  if (!win) return '';

  if (!win.pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[src*="pdf.min.js"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('PDF.js script load error')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        if (win.pdfjsLib) {
          win.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve();
        } else {
          reject(new Error('pdfjsLib not defined'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'));
      document.head.appendChild(script);
    });
  }

  const copy = buffer.slice(0);
  const loadingTask = win.pdfjsLib.getDocument({ data: copy });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const linesByY: { y: number; text: string }[] = [];

    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string') {
        const str = item.str;
        if (!str) continue;
        const y = Math.round(item.transform[5]);

        const line = linesByY.find((l) => Math.abs(l.y - y) <= 4);
        if (line) {
          if (
            line.text.length > 0 &&
            !line.text.endsWith(' ') &&
            !line.text.endsWith('-') &&
            !str.startsWith(' ')
          ) {
            line.text += ' ' + str;
          } else {
            line.text += str;
          }
        } else {
          linesByY.push({ y, text: str });
        }
      }
    }

    // Sort lines top to bottom (higher Y is higher up on page)
    linesByY.sort((a, b) => b.y - a.y);
    const pageString = linesByY
      .map((l) => l.text.trim())
      .filter((t) => t.length > 0)
      .join('\n');

    if (pageString.length > 0) {
      pageTexts.push(pageString);
    }
  }

  return pageTexts.join('\n\n');
}

/**
 * Extracts all text from a PDF ArrayBuffer by decompressing FlateDecode streams
 * and parsing text operators (Tj, TJ, hex strings, direct strings).
 */
export async function extractTextFromPdfBuffer(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const textChunks: string[] = [];

  // Stream markers in ASCII: 'stream' and 'endstream'
  const streamMarker = [115, 116, 114, 101, 97, 109];
  const endMarker = [101, 110, 100, 115, 116, 114, 101, 97, 109];

  let i = 0;
  const len = bytes.length;

  while (i < len - 10) {
    // Look for 'stream'
    let isStream = true;
    for (let k = 0; k < 6; k++) {
      if (bytes[i + k] !== streamMarker[k]) {
        isStream = false;
        break;
      }
    }

    if (isStream) {
      let start = i + 6;
      // Skip newline/whitespace after 'stream' (\r\n or \n or \r)
      while (start < len && (bytes[start] === 10 || bytes[start] === 13 || bytes[start] === 32)) {
        start++;
      }

      // Search for 'endstream'
      let end = -1;
      for (let j = start; j < len - 9; j++) {
        if (
          bytes[j] === endMarker[0] &&
          bytes[j + 1] === endMarker[1] &&
          bytes[j + 2] === endMarker[2] &&
          bytes[j + 3] === endMarker[3] &&
          bytes[j + 4] === endMarker[4] &&
          bytes[j + 5] === endMarker[5] &&
          bytes[j + 6] === endMarker[6] &&
          bytes[j + 7] === endMarker[7] &&
          bytes[j + 8] === endMarker[8]
        ) {
          end = j;
          break;
        }
      }

      if (end !== -1 && end > start) {
        let chunk = bytes.subarray(start, end);
        while (chunk.length > 0 && (chunk[chunk.length - 1] === 10 || chunk[chunk.length - 1] === 13 || chunk[chunk.length - 1] === 32)) {
          chunk = chunk.subarray(0, chunk.length - 1);
        }

        // Scan first 8 bytes for 0x78 zlib header
        let zlibChunk = chunk;
        for (let off = 0; off < Math.min(8, chunk.length); off++) {
          if (chunk[off] === 0x78) {
            zlibChunk = chunk.subarray(off);
            break;
          }
        }

        // Decompress Flate stream
        let decompressed = '';
        try {
          // Attempt 1: unzlibSync (standard zlib)
          const decompressedBytes = unzlibSync(zlibChunk);
          decompressed = strFromU8(decompressedBytes);
        } catch {
          try {
            // Attempt 2: decompressSync (raw Deflate)
            const decompressedBytes = decompressSync(chunk);
            decompressed = strFromU8(decompressedBytes);
          } catch {
            try {
              // Attempt 3: pako.inflate
              decompressed = pako.inflate(zlibChunk, { to: 'string' });
            } catch {
              try {
                // Attempt 4: pako.inflateRaw
                decompressed = pako.inflateRaw(chunk, { to: 'string' });
              } catch {
                try {
                  decompressed = new TextDecoder('utf-8').decode(chunk);
                } catch {
                  // ignore
                }
              }
            }
          }
        }

        if (decompressed && decompressed.length > 0) {
          const parsedStream = parsePdfStreamText(decompressed);
          if (parsedStream) {
            textChunks.push(parsedStream);
          }
        }

        i = end + 9;
        continue;
      }
    }

    i++;
  }

  // Also scan uncompressed ASCII portion of the PDF for direct text
  try {
    const rawAscii = new TextDecoder('latin1').decode(bytes);
    const uncompressed = parsePdfStreamText(rawAscii);
    if (uncompressed) {
      textChunks.push(uncompressed);
    }
  } catch {
    // ignore
  }

  return textChunks.join('\n\n').trim();
}

/**
 * Parses text strings from a decompressed PDF content stream.
 */
function parsePdfStreamText(content: string): string {
  const extractedLines: string[] = [];

  // 1. Text from TJ arrays: [(part 1) -10 (part 2)] TJ or [<48656c6c6f>] TJ
  const tjArrayRegex = /\[([^\]]*)\]\s*TJ\b/g;
  let arrayMatch;
  while ((arrayMatch = tjArrayRegex.exec(content)) !== null) {
    const inner = arrayMatch[1];
    const parts: string[] = [];
    const partRegex = /\(([^()]*)\)|<([0-9A-Fa-f\s]+)>|(-?\d+(?:\.\d+)?)/g;
    let p;
    while ((p = partRegex.exec(inner)) !== null) {
      if (p[1] !== undefined) {
        parts.push(unescapePdfString(p[1]));
      } else if (p[2] !== undefined) {
        parts.push(decodeHexPdfString(p[2]));
      } else if (p[3] !== undefined && parseFloat(p[3]) < -100) {
        parts.push(' ');
      }
    }
    const combined = parts.join('').trim();
    if (combined.length > 0) {
      extractedLines.push(combined);
    }
  }

  // 2. Text from single string Tj: (str) Tj
  const tjRegex = /\(([^()]*)\)\s*Tj\b/g;
  let tjMatch;
  while ((tjMatch = tjRegex.exec(content)) !== null) {
    const clean = unescapePdfString(tjMatch[1]).trim();
    if (clean.length > 0) {
      extractedLines.push(clean);
    }
  }

  // 3. Text from hex string Tj: <417368...> Tj
  const hexTjRegex = /<([0-9A-Fa-f\s]+)>\s*Tj\b/g;
  let hexMatch;
  while ((hexMatch = hexTjRegex.exec(content)) !== null) {
    const clean = decodeHexPdfString(hexMatch[1]).trim();
    if (clean.length > 0) {
      extractedLines.push(clean);
    }
  }

  // 4. Text from BT ... ET text blocks
  const btEtRegex = /BT\b([\s\S]*?)\bET/g;
  let btMatch;
  while ((btMatch = btEtRegex.exec(content)) !== null) {
    const block = btMatch[1];
    const parenRegex = /\(([^()]*)\)/g;
    let pm;
    while ((pm = parenRegex.exec(block)) !== null) {
      const clean = unescapePdfString(pm[1]).trim();
      if (clean.length > 1 && !extractedLines.includes(clean)) {
        extractedLines.push(clean);
      }
    }
  }

  return extractedLines.join('\n');
}

function unescapePdfString(str: string): string {
  return str
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

function decodeHexPdfString(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  let str = '';
  for (let k = 0; k < clean.length; k += 2) {
    const code = parseInt(clean.substring(k, k + 2), 16);
    if (!isNaN(code) && code >= 32 && code <= 126) {
      str += String.fromCharCode(code);
    } else if (code === 10 || code === 13 || code === 9) {
      str += ' ';
    }
  }
  return str;
}

// -------------------------------------------------------------
// 2. Resume Scraping / NLP Information Extractor
// -------------------------------------------------------------

/**
 * Parses resume text and scrapes all candidate fields.
 */
export function parseResumeText(text: string, fileName?: string): ExtractedResumeData {
  if (!text || text.trim().length === 0) {
    return extractFromFileName(fileName || '');
  }

  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Strictly extract ONLY the 5 requested fields:
  // 1. Name
  // 2. Email id
  // 3. Number (Phone / Mobile)
  // 4. Skills
  // 5. A little bit Description or summary
  const email = extractEmail(cleanText);
  const mobile = extractPhone(cleanText, lines);
  const name = extractName(lines, fileName, email);
  const skills = extractSkills(cleanText, lines);
  const summary = extractSummary(cleanText, lines);

  return {
    name,
    email,
    mobile,
    skills: skills && skills.length > 0 ? skills : undefined,
    summary,
    rawText: cleanText,
  };
}

// --- Specific Field Extractors ---

function extractEmail(text: string): string | undefined {
  // Clean out mailto: prefix if present
  const cleaned = text.replace(/mailto:\s*/gi, '');

  // 1. Labeled email (e.g. Email: john@doe.com)
  const labeled = cleaned.match(
    /(?:email|e-mail|mail|contact)[\s.:#]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
  );
  if (labeled && labeled[1]) {
    return labeled[1].toLowerCase().trim();
  }

  // 2. Standard email pattern
  const standardRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = cleaned.match(standardRegex);
  if (matches && matches.length > 0) {
    const valid = matches.find((e) => {
      const lower = e.toLowerCase();
      return (
        !lower.includes('example.com') &&
        !lower.includes('test.com') &&
        !lower.includes('@domain') &&
        !lower.includes('sentry.io') &&
        !lower.includes('github.com') &&
        !lower.includes('w3.org') &&
        !lower.includes('adobe.com') &&
        !lower.includes('schema.org')
      );
    });
    if (valid) return valid.toLowerCase().trim();
  }

  // 3. Spaced email (e.g. john . doe @ gmail . com)
  const spaced = cleaned.match(
    /([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,})/
  );
  if (spaced) {
    return `${spaced[1]}@${spaced[2]}.${spaced[3]}`.toLowerCase().trim();
  }

  return undefined;
}

function extractPhone(text: string, lines: string[]): string | undefined {
  // Only inspect top header lines (first 15 lines where candidate contact info is placed)
  const headerLines = lines.slice(0, 15);

  // 1. Explicitly labeled phone number: "Phone: ...", "Mobile: ...", "Cell: ...", "Tel: ..."
  for (const line of headerLines) {
    const labeled = line.match(
      /(?:phone|mobile|cell|tel(?:ephone)?|contact\s*(?:no|number)?|mob|ph)[\s.:#*-]+([+\d\s().-]{8,22})/i
    );
    if (labeled && labeled[1]) {
      const candidate = labeled[1].trim();
      const digits = candidate.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 15) {
        return formatPhone(candidate, digits);
      }
    }
  }

  // 2. Explicit phone number in header lines with recognized phone pattern
  for (const line of headerLines) {
    // 2a. Explicit +91 Indian format: +91 98765 43210 or +91-98765-43210
    const inMatch = line.match(/(?:\+91|91)[-.\s]+([6-9]\d{4})[-.\s]+(\d{5})\b/);
    if (inMatch) {
      return `+91 ${inMatch[1]} ${inMatch[2]}`;
    }

    // 2b. Explicit North American format with parentheses or hyphens: (xxx) xxx-xxxx or +1 (xxx) xxx-xxxx
    const naMatch = line.match(/(?:\+?1[-.\s]?)?\((\d{3})\)[-.\s]?(\d{3})[-.\s]?(\d{4})\b/);
    if (naMatch) {
      return `(${naMatch[1]}) ${naMatch[2]}-${naMatch[3]}`;
    }

    const naHyphenMatch = line.match(/(?:\+?1[-.\s])?([2-9]\d{2})[-.]([2-9]\d{2})[-.](\d{4})\b/);
    if (naHyphenMatch) {
      return `(${naHyphenMatch[1]}) ${naHyphenMatch[2]}-${naHyphenMatch[3]}`;
    }
  }

  // If no labeled or clearly formatted phone number exists in the header, DO NOT GUESS OR FABRICATE!
  return undefined;
}

function formatPhone(raw: string, digits: string): string {
  if (raw.includes('+91') || (digits.length === 12 && digits.startsWith('91'))) {
    const d = digits.length === 12 ? digits.slice(2) : digits;
    return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  }
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    return `+91 ${digits.slice(1, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    if (/^[6-9]/.test(digits)) {
      return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function extractLocation(text: string, lines: string[]): { city?: string; state?: string } {
  // Only look in top 15 lines (the header/contact section)
  const headerLines = lines.slice(0, 15);

  // 1. Check labeled location lines: "Location: Bhubaneswar, Odisha" or "Address: Toronto, ON"
  for (const line of headerLines) {
    const labeled = line.match(
      /(?:location|address|residence)[\s.:#]*([A-Za-z\s]{3,25})(?:,\s*([A-Za-z\s]{2,20}))?/i
    );
    if (labeled && labeled[1]) {
      const cityCand = labeled[1].trim();
      const stateCand = labeled[2] ? labeled[2].trim() : undefined;
      if (cityCand.length >= 3 && !cityCand.includes('\n')) {
        return { city: cityCand, state: stateCand };
      }
    }
  }

  // 2. Check for city, state pattern from LOCATION_PATTERNS strictly in header lines
  for (const line of headerLines) {
    for (const loc of LOCATION_PATTERNS) {
      const regex = new RegExp(`\\b([A-Z][a-zA-Z\\s]{2,20})\\s*,\\s*(?:${loc.code}|${loc.full})\\b`, 'i');
      const match = line.match(regex);
      if (match && match[1]) {
        const cityCand = match[1].trim();
        if (!cityCand.includes('\n') && cityCand.length < 25) {
          return { city: cityCand, state: loc.code };
        }
      }
    }
  }

  // Do NOT scan body for random city names! If not in the header, return {}
  return {};
}

function extractName(lines: string[], fileName?: string, email?: string): string | undefined {
  // 1. Top 8 lines analysis
  for (const line of lines.slice(0, 8)) {
    const clean = line.replace(/^[•\s*-]+/, '').trim();

    if (
      clean.length < 3 ||
      clean.length > 40 ||
      clean.includes('@') ||
      clean.includes('http') ||
      clean.includes('www.') ||
      clean.includes('|') ||
      /\d/.test(clean) ||
      /^(resume|curriculum|vitae|cv|contact|profile|page|objective|about|summary|skills|education|experience)\b/i.test(
        clean
      ) ||
      clean.split(/\s+/).length > 4 ||
      clean.split(/\s+/).length < 2
    ) {
      continue;
    }

    const words = clean.split(/\s+/);
    const isCapitalized = words.every(
      (w) => w.length > 1 && w.charAt(0) === w.charAt(0).toUpperCase()
    );

    if (isCapitalized) {
      return clean;
    }
  }

  // 2. Fallback: Parse from fileName if clean
  if (fileName) {
    const fromFile = cleanNameFromFilename(fileName);
    if (fromFile) return fromFile;
  }

  // 3. Fallback: Infer from email username (e.g. ashutosh.hota@gmail.com -> Ashutosh Hota)
  if (email) {
    const username = email.split('@')[0];
    const parts = username.split(/[._-]+/);
    if (parts.length === 2 && parts.every((p) => p.length > 1 && !/\d/.test(p))) {
      return parts
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
    }
  }

  return undefined;
}

function cleanNameFromFilename(fileName: string): string | undefined {
  const base = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b(resume|cv|curriculum|vitae|profile|document|applicant|candidate|final|latest|updated)\b/gi, '')
    .trim();

  const words = base.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 4 && !/\d/.test(base)) {
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  return undefined;
}

function extractJobTitle(text: string, lines: string[]): string | undefined {
  // 1. Inspect line directly below candidate name in top 6 lines
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i];
    if (
      /\b(engineer|developer|architect|designer|manager|lead|specialist|consultant|analyst|administrator)\b/i.test(
        line
      ) &&
      line.length >= 4 &&
      line.length < 50 &&
      !line.includes('@') &&
      !line.includes('http') &&
      !line.includes('|')
    ) {
      return line.trim();
    }
  }

  // 2. Direct match with common titles in text
  for (const title of COMMON_TITLES) {
    if (new RegExp(`\\b${title}\\b`, 'i').test(text)) {
      return title;
    }
  }

  // 3. Look for labeled title: "Current Role: ...", "Title: ..."
  const labeled = text.match(/(?:title|role|position|current\s+role)[\s.:#]*([A-Za-z\s]{4,40})/i);
  if (labeled && labeled[1]) {
    return labeled[1].trim();
  }

  // Do not fabricate a title if not found in resume
  return undefined;
}

function extractSkills(text: string, lines: string[]): string[] {
  const foundSkills = new Set<string>();

  // 1. Match from rich dictionary
  for (const skill of TECH_SKILLS) {
    const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
    if (regex.test(text)) {
      foundSkills.add(skill);
    }
  }

  // 2. Direct extraction from Skills section
  let inSkillsSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(technical\s+skills|skills|core\s+competencies|technologies|tools)\b/i.test(line)) {
      inSkillsSection = true;
      continue;
    }
    if (inSkillsSection) {
      // Stop when another section begins
      if (/^(experience|work|employment|education|certifications|projects|summary)\b/i.test(line)) {
        break;
      }
      // Remove prefixes like "Languages & Frameworks:" or "Cloud:"
      const cleaned = line.replace(/^[A-Za-z\s&/]+:\s*/, '');
      const items = cleaned
        .split(/[,|•·\t/]+/)
        .map((s) => s.trim().replace(/[()]/g, ''))
        .filter((s) => s.length >= 2 && s.length <= 30 && !/\d{4}/.test(s));

      for (const item of items) {
        if (!/^(and|or|etc|tools|concepts|languages|frameworks|cloud)$/i.test(item)) {
          foundSkills.add(item);
        }
      }
    }
  }

  return Array.from(foundSkills);
}

function extractEducation(text: string, lines: string[]): {
  degree?: string;
  institution?: string;
  year?: string;
} {
  let degree: string | undefined = undefined;
  let institution: string | undefined = undefined;
  let year: string | undefined = undefined;

  // 1. Degree regex matching B.Tech, M.Tech, BS, MS, B.E., M.E., MBA, MCA, BCA, Ph.D.
  const degreeRegex = /\b(b\.?\s*tech|bachelor\s+of\s+technology|m\.?\s*tech|master\s+of\s+technology|b\.?e\.?|m\.?e\.?|b\.?\s*s\.?c?|m\.?\s*s\.?c?|bachelor\s+of\s+science|master\s+of\s+science|bachelor\s+of\s+arts|master\s+of\s+arts|bca|mca|mba|bba|ph\.?d\.?|doctorate|associate\s+degree|diploma)(?:\s+(?:in|of)\s+[A-Za-z\t &,/]+)?/i;

  for (const line of lines) {
    if (!degree) {
      const match = line.match(degreeRegex);
      if (match) {
        degree = match[0].trim();
      }
    }

    if (!institution) {
      if (
        /\b(university|institute|college|school\s+of|academy|polytechnic)\b/i.test(line) &&
        !line.includes('@') &&
        line.length < 80
      ) {
        institution = line.replace(/^[•\s*-]+/, '').trim();
      }
    }

    if (!year) {
      const yMatch = line.match(/\b(20[0-2]\d|199\d)\b/);
      if (
        yMatch &&
        (/\b(graduat|class|passed|batch|year|education|degree)\b/i.test(line) ||
          /education/i.test(text))
      ) {
        year = yMatch[1];
      }
    }
  }

  // Fallbacks if not found in single lines
  if (!degree) {
    const fallbackDeg = text.match(degreeRegex);
    if (fallbackDeg) degree = fallbackDeg[0].trim();
  }

  if (!institution) {
    const uniRegex = /\b((?:National\s+Institute|Indian\s+Institute|University|College|Institute)\s+(?:of\s+)?[A-Za-z\s]{3,40})\b/i;
    const match = text.match(uniRegex);
    if (match && match[1]) institution = match[1].trim();
  }

  if (!year) {
    const yearRegex = /\b(?:graduated|class\s+of|degree)?\s*[:\s]*(20[0-2]\d|199\d)\b/i;
    const yearMatch = text.match(yearRegex);
    if (yearMatch) year = yearMatch[1];
  }

  return { degree, institution, year };
}

function extractExperience(text: string): string | undefined {
  // 1. Explicit statements: "X+ years of experience"
  const expMatch = text.match(/\b([1-9]|1\d)\+?\s*years?(?:\s+of)?(?:\s+experience)?\b/i);
  if (expMatch && expMatch[0]) {
    const num = expMatch[1];
    return `${num}+ Years`;
  }

  // 2. Date ranges in experience: e.g. "2018 - Present" or "2019 - 2024"
  const rangeMatch = text.match(/\b(200\d|201\d|202\d)\s*(?:-|to)\s*(present|current|202\d)\b/i);
  if (rangeMatch) {
    const startYear = parseInt(rangeMatch[1], 10);
    const endYear =
      rangeMatch[2].toLowerCase().includes('present') || rangeMatch[2].toLowerCase().includes('current')
        ? new Date().getFullYear()
        : parseInt(rangeMatch[2], 10);
    const diff = Math.max(1, endYear - startYear);
    return `${diff}+ Years`;
  }

  return undefined;
}

function extractCertifications(text: string): string[] {
  const certKeywords = [
    'AWS Certified Solutions Architect',
    'AWS Certified Developer',
    'AWS Certified SysOps',
    'AWS Certified Cloud Practitioner',
    'Microsoft Certified: Azure Fundamentals',
    'Microsoft Certified: Azure Solutions Architect',
    'Google Cloud Certified Professional Cloud Architect',
    'Google Cloud Certified Associate Cloud Engineer',
    'Certified Kubernetes Administrator (CKA)',
    'Certified Kubernetes Application Developer (CKAD)',
    'Project Management Professional (PMP)',
    'Certified ScrumMaster (CSM)',
    'Professional Scrum Master (PSM)',
    'CompTIA Security+',
    'CompTIA Network+',
    'Certified Information Systems Security Professional (CISSP)',
  ];

  const found: string[] = [];
  for (const cert of certKeywords) {
    if (new RegExp(cert.replace(/[()]/g, '\\$&'), 'i').test(text)) {
      found.push(cert);
    }
  }
  return found;
}

function extractSummary(text: string, lines: string[]): string | undefined {
  const summaryHeaderRegex = /^(?:professional\s+summary|summary|executive\s+summary|about\s+me|profile|objective|career\s+objective)\b/i;

  for (let i = 0; i < lines.length; i++) {
    if (summaryHeaderRegex.test(lines[i])) {
      const summaryLines: string[] = [];
      for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
        const next = lines[j];
        if (
          /^(experience|work|employment|education|skills|certifications|projects|key\s+skills|technical\s+skills)\b/i.test(next) ||
          next.length < 3
        ) {
          break;
        }
        summaryLines.push(next);
      }
      if (summaryLines.length > 0) {
        const full = summaryLines.join(' ').replace(/\s+/g, ' ').trim();
        if (full.length > 280) {
          const cut = full.slice(0, 280);
          const lastPeriod = cut.lastIndexOf('.');
          if (lastPeriod > 80) {
            return cut.slice(0, lastPeriod + 1).trim();
          }
          return cut.trim() + '…';
        }
        return full;
      }
    }
  }

  // Check if line 2 or 3 is a short 1-line bio / headline summary
  for (let i = 1; i < Math.min(lines.length, 4); i++) {
    const l = lines[i].trim();
    if (
      l.length > 40 &&
      l.length < 250 &&
      !l.includes('@') &&
      !l.includes('http') &&
      !/\d{10}/.test(l) &&
      !/^(education|skills|experience|projects)\b/i.test(l)
    ) {
      return l;
    }
  }

  // Do NOT add mock data - leave blank if not present
  return undefined;
}

function extractFromFileName(fileName: string): ExtractedResumeData {
  const name = cleanNameFromFilename(fileName);
  return {
    name,
    rawText: '',
  };
}
