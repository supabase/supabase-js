/*
 * The host imports behind libpq's connect path.
 *
 * It lives outside libpq.a so that shared objects built from libpq (loaded by GHC's Template
 * Haskell loader, which can only resolve env imports) carry an ordinary undefined symbol; the
 * final executable links this object to turn it into the supa_net.tcp_connect and supa_net.sock_error imports.
 */
#include <stddef.h>

__attribute__((import_module("supa_net"), import_name("tcp_connect")))
extern int supa_net_host_tcp_connect(const char *addr, size_t addr_len, int attempt_timeout_ms, int *fd_out);

__attribute__((import_module("supa_net"), import_name("sock_error")))
extern int supa_net_host_sock_error(int fd, int *err_out, int *elapsed_ms_out);

int
supa_net_tcp_connect(const char *addr, size_t addr_len, int attempt_timeout_ms, int *fd_out)
{
	return supa_net_host_tcp_connect(addr, addr_len, attempt_timeout_ms, fd_out);
}

int
supa_net_sock_error(int fd, int *err_out, int *elapsed_ms_out)
{
	return supa_net_host_sock_error(fd, err_out, elapsed_ms_out);
}
