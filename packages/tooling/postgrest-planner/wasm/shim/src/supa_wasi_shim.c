/*
 * POSIX surface missing from wasi-libc, so that code which links against it (libpq, network) builds and links.
 *
 * The planner never opens a connection or a socket: it only loads a schema cache document and plans requests. The
 * name resolution and socket entry points are therefore declared (see include/) and defined as traps, so any call is
 * a bug that fails loudly instead of silently misbehaving. The identity and signal shims below are real: libpq and
 * the RTS call them while initialising.
 */
#include <errno.h>
#include <netdb.h>
#include <netinet/in.h>
#include <pwd.h>
#include <signal.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

#define SUPA_TRAP() __builtin_trap()

int getaddrinfo(const char *restrict host, const char *restrict serv, const struct addrinfo *restrict hints, struct addrinfo **restrict res) { SUPA_TRAP(); }
void freeaddrinfo(struct addrinfo *res) { SUPA_TRAP(); }
int getnameinfo(const struct sockaddr *restrict sa, socklen_t salen, char *restrict host, socklen_t hostlen, char *restrict serv, socklen_t servlen, int flags) { SUPA_TRAP(); }
const char *gai_strerror(int ecode) { SUPA_TRAP(); }
struct servent *getservbyname(const char *name, const char *proto) { SUPA_TRAP(); }
struct servent *getservbyport(int port, const char *proto) { SUPA_TRAP(); }
struct hostent *gethostbyname(const char *name) { SUPA_TRAP(); }

int socket(int domain, int type, int protocol) { SUPA_TRAP(); }
int socketpair(int domain, int type, int protocol, int sv[2]) { SUPA_TRAP(); }
int connect(int fd, const struct sockaddr *addr, socklen_t len) { SUPA_TRAP(); }
int bind(int fd, const struct sockaddr *addr, socklen_t len) { SUPA_TRAP(); }
int listen(int fd, int backlog) { SUPA_TRAP(); }
int getsockname(int fd, struct sockaddr *restrict sa, socklen_t *restrict len) { SUPA_TRAP(); }
int getpeername(int fd, struct sockaddr *restrict sa, socklen_t *restrict len) { SUPA_TRAP(); }
int getsockopt(int fd, int level, int name, void *restrict val, socklen_t *restrict len) { SUPA_TRAP(); }
int setsockopt(int fd, int level, int name, const void *val, socklen_t len) { SUPA_TRAP(); }
ssize_t sendto(int fd, const void *buf, size_t len, int flags, const struct sockaddr *addr, socklen_t alen) { SUPA_TRAP(); }
ssize_t recvfrom(int fd, void *restrict buf, size_t len, int flags, struct sockaddr *restrict addr, socklen_t *restrict alen) { SUPA_TRAP(); }

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
