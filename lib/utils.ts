// For now, we'll use a simple user system (can add auth later)
// In production, this would use proper authentication
export function getCurrentUserId(req: Request): string {
  // For MVP, use a default user or get from session/auth
  // TODO: Implement proper authentication
  return req.headers.get('x-user-id') || 'default-user-1'
}
