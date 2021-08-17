const assert = require('assert');

const SuccessCode = 'ok';

const ErrorCode = {
  InvalidArgument: 'invalidArgument',
  NotFound: 'notFound',
  AlreadyExists: 'alreadyExists',
  PermissionDenied: 'permissionDenied',
  FailedPrecondition: 'failedPrecondition',
  Unimplemented: 'unimplemented',
  Internal: 'internal',
  Unavailable: 'unavailable',
  Unauthenticated: 'unauthenticated',
};

const okResponse = (data, message) => {
  assert(message != null);

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

  const response = {
    code,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return response;
};

module.exports = {
  okResponse,
  errorResponse,
  SuccessCode,
  ErrorCode,
};
