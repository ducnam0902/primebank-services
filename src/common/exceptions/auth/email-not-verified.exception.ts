import { HttpStatus } from "@nestjs/common";
import { BaseException } from "../base.exception";
import { ErrorCode } from "../../constants/error-codes.constant";

export class EmailNotVerifiedException extends BaseException {
    constructor() {
        super(ErrorCode.EMAIL_NOT_VERIFIED, "Email is not verified", HttpStatus.FORBIDDEN);
    }
}