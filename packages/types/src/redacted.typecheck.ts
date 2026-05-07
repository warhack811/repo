import { type Redacted, redact } from './redacted.js';

const redactedString = redact('secret');

// @ts-expect-error Redacted<string> must not flow into raw string sinks without unwrap.
const rawString: string = redactedString;

const assignedRedacted: Redacted<string> = redactedString;

void assignedRedacted;
void rawString;
