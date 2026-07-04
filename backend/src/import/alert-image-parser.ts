import { ParsedAlert } from './alert-text-parser';

/**
 * Extracts structured card-alert transactions from a bank-notification
 * screenshot. The rest of the import pipeline only depends on this interface,
 * so how the image is understood is swappable.
 *
 * The active implementation is chosen in ImportModule by the
 * ALERT_IMAGE_PARSER env var (default "ocr" → OcrAlertImageParser:
 * tesseract.js OCR + parseAlertText). To switch to a vision LLM later,
 * implement this interface with a class that sends the image to the model and
 * returns ParsedAlert[] directly (no OCR step), then register it in the
 * ImportModule factory under a new env value (e.g. "vision").
 */
export interface AlertImageParser {
  parseImage(image: Buffer, mimeType: string): Promise<ParsedAlert[]>;
}

/** Injection token for the configured AlertImageParser implementation. */
export const ALERT_IMAGE_PARSER = Symbol('ALERT_IMAGE_PARSER');
