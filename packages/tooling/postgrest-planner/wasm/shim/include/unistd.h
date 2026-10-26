/* wasi-libc has no user/group ids or umask; the shim returns fixed values. */
#ifndef SUPA_WASI_UNISTD_H
#define SUPA_WASI_UNISTD_H

#include_next <unistd.h>
#include <sys/types.h>

#ifdef __cplusplus
extern "C" {
#endif

uid_t getuid(void);
uid_t geteuid(void);
gid_t getgid(void);
gid_t getegid(void);
mode_t umask(mode_t mask);

#ifdef __cplusplus
}
#endif

#endif
