/*
 * Option (b) of the spike: the wasm libpq is linked (hasql -> postgresql-libpq drags it in), but the
 * planner never opens a connection. libpq's connect path calls these two host functions; instead of
 * importing them from the host (supa_net.*) we define them here as traps, so the module has no
 * supa_net imports at all and any call is a bug that fails loudly.
 */
#include <stddef.h>

int
supa_net_tcp_connect(const char *addr, size_t addr_len, int attempt_timeout_ms, int *fd_out)
{
	(void) addr; (void) addr_len; (void) attempt_timeout_ms; (void) fd_out;
	__builtin_trap();
}

int
supa_net_sock_error(int fd, int *err_out, int *elapsed_ms_out)
{
	(void) fd; (void) err_out; (void) elapsed_ms_out;
	__builtin_trap();
}
