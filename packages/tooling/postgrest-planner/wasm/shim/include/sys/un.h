/* Unix-domain sockets do not exist on WASI; the struct is only here so libpq's path math compiles. */
#ifndef SUPA_WASI_SYS_UN_H
#define SUPA_WASI_SYS_UN_H

#define __wasilibc___struct_sockaddr_un_h
#include <__typedef_sa_family_t.h>

struct sockaddr_un {
	sa_family_t sun_family;
	char sun_path[108];
};

#endif
