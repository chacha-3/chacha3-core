const assert = require('assert');

const SuccessCode = 'ok';

const ErrorCode = {
  InvalidArgument: 'invalidArgument',
  NotFound: 'notFound',
  AlreadyExist: 'alreadyExists',
  PermissionDenied: 'permissionDenied',
  FailedPrecondition: 'failedPrecondition',
  Unimplemented: 'unimplemented',
  Internal: 'internal',
  Unavailable: 'unavailable',
  Unauthenticated: 'unauthenticated',
};

const okResponse = (data, message) => {
  const response = {
    message,
    code: SuccessCode,
  };

  if (data) {
    response.data = data;
  }

  return response;
};

const errorResponse = (code, message, errors) => {
  if (errors) {
    assert(Array.isArray(errors));
  }

  const msg = message || ErrorCode[code] || '';
  return { code, message: msg, errors };
};

module.exports = {
  okResponse,
  errorResponse,
  SuccessCode,
  ErrorCode,
};
