// QA-only override lets concurrent local projects retain their own preview port.
export const QA_PREVIEW_URL = process.env.CIVITAS_QA_PREVIEW_URL ?? 'http://127.0.0.1:4173/';
if (new URL(QA_PREVIEW_URL).hostname !== '127.0.0.1') {
  throw new Error('Desktop responsive QA requires the local production preview on 127.0.0.1');
}
