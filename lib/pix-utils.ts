/**
 * Utility to generate PIX BRCode (Payload) for QR Code generation.
 * Following EMV QRCPS specification for PIX.
 */

export class Pix {
  private pixKey: string;
  private merchantName: string;
  private merchantCity: string;
  private txid: string;
  private amount?: string;
  private description?: string;

  private readonly ID_PAYLOAD_FORMAT_INDICATOR = '00';
  private readonly ID_MERCHANT_ACCOUNT_INFORMATION = '26';
  private readonly ID_MERCHANT_ACCOUNT_INFORMATION_GUI = '00';
  private readonly ID_MERCHANT_ACCOUNT_INFORMATION_KEY = '01';
  private readonly ID_MERCHANT_ACCOUNT_INFORMATION_DESCRIPTION = '02';
  private readonly ID_MERCHANT_CATEGORY_CODE = '52';
  private readonly ID_TRANSACTION_CURRENCY = '53';
  private readonly ID_TRANSACTION_AMOUNT = '54';
  private readonly ID_COUNTRY_CODE = '58';
  private readonly ID_MERCHANT_NAME = '59';
  private readonly ID_MERCHANT_CITY = '60';
  private readonly ID_ADDITIONAL_DATA_FIELD_TEMPLATE = '62';
  private readonly ID_ADDITIONAL_DATA_FIELD_TEMPLATE_TXID = '05';
  private readonly ID_CRC16 = '63';

  constructor(
    pixKey: string,
    merchantName: string,
    merchantCity: string,
    txid: string = '***',
    amount?: string,
    description?: string
  ) {
    this.pixKey = pixKey;
    this.merchantName = this.normalizeText(merchantName).substring(0, 25);
    this.merchantCity = this.normalizeText(merchantCity).substring(0, 15);
    this.txid = txid;
    this.amount = amount;
    this.description = description;
  }

  private normalizeText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
  }

  private getValue(id: string, value: string): string {
    const size = String(value.length).padStart(2, '0');
    return id + size + value;
  }

  private getMerchantAccountInformation(): string {
    const gui = this.getValue(this.ID_MERCHANT_ACCOUNT_INFORMATION_GUI, 'br.gov.bcb.pix');
    const key = this.getValue(this.ID_MERCHANT_ACCOUNT_INFORMATION_KEY, this.pixKey);
    const description = this.description 
      ? this.getValue(this.ID_MERCHANT_ACCOUNT_INFORMATION_DESCRIPTION, this.description) 
      : '';
    return this.getValue(this.ID_MERCHANT_ACCOUNT_INFORMATION, gui + key + description);
  }

  private getAdditionalDataFieldTemplate(): string {
    const txid = this.getValue(this.ID_ADDITIONAL_DATA_FIELD_TEMPLATE_TXID, this.txid);
    return this.getValue(this.ID_ADDITIONAL_DATA_FIELD_TEMPLATE, txid);
  }

  public getPayload(): string {
    const payload =
      this.getValue(this.ID_PAYLOAD_FORMAT_INDICATOR, '01') +
      this.getMerchantAccountInformation() +
      this.getValue(this.ID_MERCHANT_CATEGORY_CODE, '0000') +
      this.getValue(this.ID_TRANSACTION_CURRENCY, '986') +
      (this.amount ? this.getValue(this.ID_TRANSACTION_AMOUNT, this.amount) : '') +
      this.getValue(this.ID_COUNTRY_CODE, 'BR') +
      this.getValue(this.ID_MERCHANT_NAME, this.merchantName) +
      this.getValue(this.ID_MERCHANT_CITY, this.merchantCity) +
      this.getAdditionalDataFieldTemplate();

    return payload + this.ID_CRC16 + '04' + this.getCRC16(payload + this.ID_CRC16 + '04');
  }

  private getCRC16(payload: string): string {
    let crc = 0xFFFF;
    const polynomial = 0x1021;

    for (let i = 0; i < payload.length; i++) {
      let b = payload.charCodeAt(i);
      for (let j = 0; j < 8; j++) {
        let bit = ((b >> (7 - j) & 1) === 1);
        let c15 = ((crc >> 15 & 1) === 1);
        crc <<= 1;
        if (c15 !== bit) crc ^= polynomial;
      }
    }

    crc &= 0xFFFF;
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
}
