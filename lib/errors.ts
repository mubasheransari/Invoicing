/** Error that carries the HTTP status the API route should answer with. */
export class HttpError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
