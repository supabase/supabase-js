/* Minimal netdb.h for wasm32-wasi: declarations only, the shim defines every function as a trap. */
#ifndef SUPA_WASI_NETDB_H
#define SUPA_WASI_NETDB_H

#include <sys/socket.h>
#include <netinet/in.h>

#ifdef __cplusplus
extern "C" {
#endif

struct addrinfo {
	int ai_flags;
	int ai_family;
	int ai_socktype;
	int ai_protocol;
	socklen_t ai_addrlen;
	struct sockaddr *ai_addr;
	char *ai_canonname;
	struct addrinfo *ai_next;
};

struct servent {
	char *s_name;
	char **s_aliases;
	int s_port;
	char *s_proto;
};

struct hostent {
	char *h_name;
	char **h_aliases;
	int h_addrtype;
	int h_length;
	char **h_addr_list;
};
#define h_addr h_addr_list[0]

#define AI_PASSIVE 0x01
#define AI_CANONNAME 0x02
#define AI_NUMERICHOST 0x04
#define AI_V4MAPPED 0x08
#define AI_ALL 0x10
#define AI_ADDRCONFIG 0x20
#define AI_NUMERICSERV 0x400

#define NI_NUMERICHOST 0x01
#define NI_NUMERICSERV 0x02
#define NI_NOFQDN 0x04
#define NI_NAMEREQD 0x08
#define NI_DGRAM 0x10
#define NI_MAXHOST 255
#define NI_MAXSERV 32

#define EAI_BADFLAGS -1
#define EAI_NONAME -2
#define EAI_AGAIN -3
#define EAI_FAIL -4
#define EAI_FAMILY -6
#define EAI_SOCKTYPE -7
#define EAI_SERVICE -8
#define EAI_MEMORY -10
#define EAI_SYSTEM -11
#define EAI_OVERFLOW -12

int getaddrinfo(const char *restrict host, const char *restrict serv,
				const struct addrinfo *restrict hints, struct addrinfo **restrict res);
void freeaddrinfo(struct addrinfo *res);
int getnameinfo(const struct sockaddr *restrict sa, socklen_t salen,
				char *restrict host, socklen_t hostlen,
				char *restrict serv, socklen_t servlen, int flags);
const char *gai_strerror(int ecode);

struct servent *getservbyname(const char *name, const char *proto);
struct servent *getservbyport(int port, const char *proto);
struct hostent *gethostbyname(const char *name);

#ifdef __cplusplus
}
#endif

#endif
