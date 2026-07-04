import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createWorker, OEM, Worker } from 'tesseract.js';
import { AlertImageParser } from './alert-image-parser';
import { ParsedAlert, parseAlertText } from './alert-text-parser';

/**
 * OCR implementation of AlertImageParser: tesseract.js reads the screenshot
 * text, parseAlertText extracts the transactions.
 */
@Injectable()
export class OcrAlertImageParser implements AlertImageParser, OnModuleDestroy {
  private readonly logger = new Logger(OcrAlertImageParser.name);
  private worker: Promise<Worker> | null = null;

  /**
   * Lazy singleton: the first call downloads the Spanish traineddata (cached
   * in backend/.tesseract) and boots the WASM engine; later calls reuse the
   * worker, which queues concurrent jobs internally.
   */
  private getWorker(): Promise<Worker> {
    this.worker ??= createWorker('spa', OEM.LSTM_ONLY, {
      cachePath: '.tesseract',
    }).catch((err: Error) => {
      // Reset so the next request retries (e.g. traineddata download failed).
      this.worker = null;
      throw err;
    });
    return this.worker;
  }

  async parseImage(image: Buffer): Promise<ParsedAlert[]> {
    const worker = await this.getWorker();
    const { data } = await worker.recognize(image);
    const alerts = parseAlertText(data.text);
    this.logger.log(
      `OCR read ${data.text.length} chars, ${alerts.length} alerts recognized`,
    );
    // The raw OCR text is the only way to diagnose unrecognized alerts.
    //this.logger.debug(`OCR text:\n${data.text}`);
    return alerts;
  }

  async onModuleDestroy(): Promise<void> {
    const pending = this.worker;
    this.worker = null;
    if (pending) {
      await pending.then(
        (w) => w.terminate(),
        () => undefined,
      );
    }
  }
}
