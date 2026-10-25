/*
 * POSIX socket surface missing from wasi-libc, backed by the supa_net host import.
 *
 * Name resolution and connect happen in the host: getaddrinfo() interns "host" in a table and
 * returns a sockaddr_in carrying (id, port); supa_tcp_connect_sockaddr() turns that back into
 * "host:port" for supa_net.tcp_connect. The remaining socket calls are stubs that either succeed
 * for advisory options or fail with ENOSYS, so code that links against them (libpq, network)
 * builds and degrades predictably.
 */
#include <errno.h>
#include <netdb.h>
#include <netinet/in.h>
#include <pwd.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>
#include <wasi/api.h>

/* Provided by the final link (the planner's cbits/supa_net_stub.c). */
extern int supa_net_tcp_connect(const char *addr, size_t addr_len, int attempt_timeout_ms, int *fd_out);
extern int supa_net_sock_error(int fd, int *err_out, int *elapsed_ms_out);

#define SUPA_MAX_HOSTS 64

static char *supa_hosts[SUPA_MAX_HOSTS];
static int supa_nhosts;

/* Returns a 1-based id for host, or 0 when the table is full or out of memory. */
static uint32_t
supa_intern_host(const char *host)
{
	for (int i = 0; i < supa_nhosts; i++)
		if (strcmp(supa_hosts[i], host) == 0)
			return (uint32_t) i + 1;
	if (supa_nhosts == SUPA_MAX_HOSTS)
		return 0;
	char *copy = strdup(host);
	if (copy == NULL)
		return 0;
	supa_hosts[supa_nhosts] = copy;
	return (uint32_t) ++supa_nhosts;
}

static const char *
supa_host_by_id(uint32_t id)
{
	return (id >= 1 && id <= (uint32_t) supa_nhosts) ? supa_hosts[id - 1] : NULL;
}

/*
 * Starts a connect to the host/port encoded by getaddrinfo(); returns a pending nonblocking fd or
 * -1 with errno. The host tries every resolved address, each bounded by attempt_timeout_ms (<= 0:
 * the OS decides).
 */
int
supa_tcp_connect_sockaddr(const struct sockaddr *sa, socklen_t len, int attempt_timeout_ms)
{
	if (sa == NULL || len < sizeof(struct sockaddr_in) || sa->sa_family != AF_INET)
	{
		errno = EAFNOSUPPORT;
		return -1;
	}

	const struct sockaddr_in *in = (const struct sockaddr_in *) sa;
	const char *host = supa_host_by_id(in->sin_addr.s_addr);
	if (host == NULL)
	{
		errno = EINVAL;
		return -1;
	}

	char addr[320];
	int n = snprintf(addr, sizeof(addr), strchr(host, ':') ? "[%s]:%u" : "%s:%u", host,
					 (unsigned) ntohs(in->sin_port));
	if (n < 0 || (size_t) n >= sizeof(addr))
	{
		errno = ENAMETOOLONG;
		return -1;
	}

	int fd = -1;
	int rc = supa_net_tcp_connect(addr, (size_t) n, attempt_timeout_ms, &fd);
	if (rc != 0)
	{
		errno = rc;
		return -1;
	}
	return fd;
}

/* Entry points used by the libpq connect patch. */
int
pg_wasi_tcp_open(const struct sockaddr *sa, socklen_t len, int attempt_timeout_ms)
{
	return supa_tcp_connect_sockaddr(sa, len, attempt_timeout_ms);
}

/* SO_ERROR of a pending connect; on success *elapsed_ms is the duration of the winning attempt. */
int
pg_wasi_sock_error(int fd, int *err, int *elapsed_ms)
{
	int rc = supa_net_sock_error(fd, err, elapsed_ms);
	if (rc != 0)
	{
		errno = rc;
		return -1;
	}
	return 0;
}

int
getaddrinfo(const char *restrict host, const char *restrict serv,
			const struct addrinfo *restrict hints, struct addrinfo **restrict res)
{
	unsigned long port = 0;
	int family = hints ? hints->ai_family : AF_UNSPEC;

	if (family != AF_UNSPEC && family != AF_INET && family != AF_INET6)
		return EAI_FAMILY;
	if (serv != NULL && serv[0] != '\0')
	{
		char *end;
		port = strtoul(serv, &end, 10);
		if (*end != '\0' || port > 65535)
		{
			if (strcmp(serv, "postgresql") != 0)
				return EAI_SERVICE;
			port = 5432;
		}
	}

	uint32_t id = supa_intern_host(host && host[0] ? host : "localhost");
	if (id == 0)
		return EAI_MEMORY;

	struct addrinfo *ai = calloc(1, sizeof(*ai));
	struct sockaddr_in *in = calloc(1, sizeof(*in));
	if (ai == NULL || in == NULL)
	{
		free(ai);
		free(in);
		return EAI_MEMORY;
	}
	in->sin_family = AF_INET;
	in->sin_port = htons((uint16_t) port);
	in->sin_addr.s_addr = id;
	ai->ai_family = AF_INET;
	ai->ai_socktype = hints && hints->ai_socktype ? hints->ai_socktype : SOCK_STREAM;
	ai->ai_protocol = hints ? hints->ai_protocol : 0;
	ai->ai_addrlen = sizeof(*in);
	ai->ai_addr = (struct sockaddr *) in;
	*res = ai;
	return 0;
}

void
freeaddrinfo(struct addrinfo *res)
{
	while (res != NULL)
	{
		struct addrinfo *next = res->ai_next;
		free(res->ai_addr);
		free(res->ai_canonname);
		free(res);
		res = next;
	}
}

int
getnameinfo(const struct sockaddr *restrict sa, socklen_t salen, char *restrict host,
			socklen_t hostlen, char *restrict serv, socklen_t servlen, int flags)
{
	(void) flags;
	if (sa == NULL || salen < sizeof(struct sockaddr_in) || sa->sa_family != AF_INET)
		return EAI_FAMILY;

	const struct sockaddr_in *in = (const struct sockaddr_in *) sa;
	const char *name = supa_host_by_id(in->sin_addr.s_addr);
	if (host != NULL && hostlen > 0)
	{
		if (name == NULL || strlen(name) >= hostlen)
			return EAI_OVERFLOW;
		strcpy(host, name);
	}
	if (serv != NULL && servlen > 0)
	{
		int n = snprintf(serv, servlen, "%u", (unsigned) ntohs(in->sin_port));
		if (n < 0 || (socklen_t) n >= servlen)
			return EAI_OVERFLOW;
	}
	return 0;
}

const char *
gai_strerror(int ecode)
{
	switch (ecode)
	{
		case 0: return "Success";
		case EAI_BADFLAGS: return "Invalid flags";
		case EAI_NONAME: return "Name or service not known";
		case EAI_AGAIN: return "Temporary failure in name resolution";
		case EAI_FAIL: return "Non-recoverable failure in name resolution";
		case EAI_FAMILY: return "Address family not supported";
		case EAI_SOCKTYPE: return "Socket type not supported";
		case EAI_SERVICE: return "Service not supported";
		case EAI_MEMORY: return "Out of memory";
		case EAI_SYSTEM: return "System error";
		case EAI_OVERFLOW: return "Buffer overflow";
		default: return "Unknown error";
	}
}

struct servent *getservbyname(const char *name, const char *proto) { (void) name; (void) proto; return NULL; }
struct servent *getservbyport(int port, const char *proto) { (void) port; (void) proto; return NULL; }
struct hostent *gethostbyname(const char *name) { (void) name; return NULL; }

/* Sockets are created by the host; creating or binding one in the guest is unsupported. */
int socket(int domain, int type, int protocol) { (void) domain; (void) type; (void) protocol; errno = ENOSYS; return -1; }
int socketpair(int domain, int type, int protocol, int sv[2]) { (void) domain; (void) type; (void) protocol; (void) sv; errno = ENOSYS; return -1; }
int connect(int fd, const struct sockaddr *addr, socklen_t len) { (void) fd; (void) addr; (void) len; errno = ENOSYS; return -1; }
int bind(int fd, const struct sockaddr *addr, socklen_t len) { (void) fd; (void) addr; (void) len; errno = ENOSYS; return -1; }
int listen(int fd, int backlog) { (void) fd; (void) backlog; errno = ENOSYS; return -1; }

/* Local and peer addresses are not tracked by the host: report an unspecified IPv4 address. */
static int
supa_unspecified_addr(struct sockaddr *restrict sa, socklen_t *restrict len)
{
	struct sockaddr_in in;
	memset(&in, 0, sizeof(in));
	in.sin_family = AF_INET;
	if (sa != NULL && len != NULL)
	{
		memcpy(sa, &in, *len < sizeof(in) ? *len : sizeof(in));
		*len = sizeof(in);
	}
	return 0;
}

int getsockname(int fd, struct sockaddr *restrict sa, socklen_t *restrict len) { (void) fd; return supa_unspecified_addr(sa, len); }
int getpeername(int fd, struct sockaddr *restrict sa, socklen_t *restrict len) { (void) fd; return supa_unspecified_addr(sa, len); }

/* preview1 getsockopt() only knows SO_TYPE; SO_ERROR comes from the host's connect state. */
int
getsockopt(int fd, int level, int name, void *restrict val, socklen_t *restrict len)
{
	int out;

	if (level != SOL_SOCKET)
	{
		errno = ENOPROTOOPT;
		return -1;
	}
	if (name == SO_ERROR)
	{
		int elapsed_ms;
		if (pg_wasi_sock_error(fd, &out, &elapsed_ms) != 0)
		{
			/* Accepted sockets have no pending connect and no error state. */
			if (errno != ENOTSOCK)
				return -1;
			out = 0;
		}
	}
	else if (name == SO_TYPE)
	{
		__wasi_fdstat_t st;
		if (__wasi_fd_fdstat_get((__wasi_fd_t) fd, &st) != 0)
		{
			errno = EBADF;
			return -1;
		}
		if (st.fs_filetype == __WASI_FILETYPE_SOCKET_STREAM)
			out = SOCK_STREAM;
		else if (st.fs_filetype == __WASI_FILETYPE_SOCKET_DGRAM)
			out = SOCK_DGRAM;
		else
		{
			errno = ENOTSOCK;
			return -1;
		}
	}
	else
	{
		errno = ENOPROTOOPT;
		return -1;
	}
	if (val != NULL && len != NULL)
	{
		memcpy(val, &out, *len < sizeof(out) ? *len : sizeof(out));
		*len = sizeof(out);
	}
	return 0;
}

/* Socket options are advisory for host-managed streams: accept the common ones, reject the rest. */
int
setsockopt(int fd, int level, int name, const void *val, socklen_t len)
{
	(void) fd; (void) val; (void) len;
	if ((level == IPPROTO_TCP) || (level == SOL_SOCKET))
		return 0;
	errno = ENOPROTOOPT;
	return -1;
}

ssize_t
sendto(int fd, const void *buf, size_t len, int flags, const struct sockaddr *addr, socklen_t alen)
{
	(void) addr; (void) alen;
	return send(fd, buf, len, flags);
}

ssize_t
recvfrom(int fd, void *restrict buf, size_t len, int flags, struct sockaddr *restrict addr,
		 socklen_t *restrict alen)
{
	if (addr != NULL && alen != NULL)
		supa_unspecified_addr(addr, alen);
	return recv(fd, buf, len, flags);
}

/* There is no user database or privilege model inside the sandbox. */
pid_t getpid(void) { return 1; }
uid_t getuid(void) { return 1000; }
uid_t geteuid(void) { return 1000; }
gid_t getgid(void) { return 1000; }
gid_t getegid(void) { return 1000; }
mode_t umask(mode_t mask) { return mask; }

static struct passwd supa_pw = {"supa", "x", 1000, 1000, "", "/", "/bin/sh"};
struct passwd *getpwuid(uid_t uid) { (void) uid; return &supa_pw; }
struct passwd *getpwnam(const char *name) { (void) name; return &supa_pw; }
int
getpwuid_r(uid_t uid, struct passwd *pwd, char *buf, size_t buflen, struct passwd **result)
{
	(void) uid; (void) buf; (void) buflen;
	*pwd = supa_pw;
	*result = pwd;
	return 0;
}

/* No signals are delivered inside the sandbox; masks and handlers are accepted and ignored. */
int sigemptyset(sigset_t *set) { *set = 0; return 0; }
int sigfillset(sigset_t *set) { *set = (sigset_t) ~0u; return 0; }
int sigaddset(sigset_t *set, int signo) { if (signo < 1 || signo > 7) return 0; *set |= (sigset_t) (1u << signo); return 0; }
int sigdelset(sigset_t *set, int signo) { if (signo < 1 || signo > 7) return 0; *set &= (sigset_t) ~(1u << signo); return 0; }
int sigismember(const sigset_t *set, int signo) { if (signo < 1 || signo > 7) return 0; return (*set >> signo) & 1; }
int sigprocmask(int how, const sigset_t *restrict set, sigset_t *restrict old) { (void) how; (void) set; if (old) *old = 0; return 0; }
int pthread_sigmask(int how, const sigset_t *restrict set, sigset_t *restrict old) { return sigprocmask(how, set, old); }
int sigpending(sigset_t *set) { *set = 0; return 0; }
int sigwait(const sigset_t *restrict set, int *restrict sig) { (void) set; (void) sig; return ENOSYS; }
int sigaction(int signo, const struct sigaction *restrict act, struct sigaction *restrict old) { (void) signo; (void) act; if (old) memset(old, 0, sizeof(*old)); return 0; }
int kill(pid_t pid, int sig) { (void) pid; (void) sig; errno = ENOSYS; return -1; }
