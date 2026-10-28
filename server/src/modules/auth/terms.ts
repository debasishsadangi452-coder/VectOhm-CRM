// Single source of truth for the desktop agent's monitoring notice -- both
// the API (login/refresh responses, accept-terms validation) and the
// desktop agent's terms screen read from this, so what's shown and what's
// recorded as accepted can never drift apart. Bump CURRENT_TERMS_VERSION
// whenever TERMS_TEXT changes; every employee (even ones who already
// accepted an older version) will be gated again on their next login.
import { SCREEN_RECORDING_RETENTION_DAYS } from "../screen-recordings/retention";

export const CURRENT_TERMS_VERSION = "2026-10-15";

export const TERMS_TEXT = `Venus CRM Desktop Monitoring Notice
Version ${CURRENT_TERMS_VERSION}

This application records your screen and tracks certain activity, as company policy. Before you can sign in, please review what that means:

Work sessions. Your clock-in and clock-out times are recorded.

Screen recording -- always on. The application starts automatically when your computer starts and records your screen continuously for as long as it is running and you are signed in, uploaded in short clips. This is not limited to the time you are clocked in: it also records during breaks, while you are idle, and outside working hours, and it does not stop when you clock out. Anything shown on your screen is captured, including personal content, so please do not use this computer for anything you would not want your employer to be able to see. Recordings are not saved on your computer. They are kept for ${SCREEN_RECORDING_RETENTION_DAYS} days and then automatically deleted. Recording stops only if you sign out or quit the application; quitting while signed in notifies HR and Admin.

Activity status. While you are clocked in and not on break, the application reports whether your mouse or keyboard have been active recently, based on idle time only, and how many keystrokes and mouse clicks occurred, as counts only. It does not record what you type or click -- no keystroke content, no key values, no click coordinates or targets, no audio, no camera.

Idle check. If there is no keyboard or mouse activity for several minutes while you are clocked in, the application asks whether you are still working and asks for a reason. Your reason and the idle duration are shared with your manager, HR and Admin and appear in your daily log.

Who can see this. Your manager, and HR/Admin staff, consistent with company monitoring access policy.

By clicking "I Accept," you confirm you've read this notice and agree to this monitoring, including screen recording whenever this application is running and you are signed in. You can review this notice again at any time from the tray menu.`;
