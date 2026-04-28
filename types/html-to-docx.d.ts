declare module 'html-to-docx' {
  export default function htmlToDocx(
    html: string,
    header?: any,
    options?: {
      table?: { row?: { cantSplit?: boolean } };
      footer?: boolean;
      pageNumber?: boolean;
    },
    footer?: any
  ): Promise<Blob | Buffer>;
}
