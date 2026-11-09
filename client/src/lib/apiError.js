export function apiError(error) {
  return error?.response?.data?.message || error.message || "Something went wrong";
}
