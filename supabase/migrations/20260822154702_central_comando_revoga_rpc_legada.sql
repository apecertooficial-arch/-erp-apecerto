-- A API usa exclusivamente a v2. A v1 permanece interna porque a v2 reaproveita
-- seus agregados sob o papel proprietário, mas deixa de ser chamável por um
-- usuário autenticado através da Data API.
revoke execute on function public.central_comando_dashboard(integer)
  from authenticated;
