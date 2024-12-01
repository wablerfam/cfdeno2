// https://blog.ojisan.io/my-new-error/

export class DataError extends Error {
  public errorCode: number;

  constructor(errorCode: number, message: string | undefined) {
    super(message);
    this.name = "DataError";
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, DataError.prototype);
  }
}
