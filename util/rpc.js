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

const okResponse = (message, data) => ({ message, data, code: SuccessCode });

const errorResponse = (code, message, errors) => {
  const msg = message || ErrorCode[code] || '';
  return { code, message: msg, errors };
};

module.exports = {
  okResponse,
  errorResponse,
  SuccessCode,
  ErrorCode,
};
