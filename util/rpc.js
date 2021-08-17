const SuccessCode = 'ok';

const ErrorCode = {
  invalidArgument: 'Invalid argument',
  notFound: 'Not found',
  alreadyExists: 'Already exists',
  permissionDenied: 'Permission denied',
  failedPrecondition: 'Failed precondition',
  unimplemented: 'Unimplemented',
  internal: 'Internal',
  unavailable: 'Unavailable',
  unauthenticated: 'Unauthenticated',
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
