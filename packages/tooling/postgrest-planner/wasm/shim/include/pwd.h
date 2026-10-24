/* Minimal pwd.h for wasm32-wasi: there is no passwd database. */
#ifndef SUPA_WASI_PWD_H
#define SUPA_WASI_PWD_H

#include <sys/types.h>
#include <stddef.h>

struct passwd {
	char *pw_name;
	char *pw_passwd;
	uid_t pw_uid;
	gid_t pw_gid;
	char *pw_gecos;
	char *pw_dir;
	char *pw_shell;
};

struct passwd *getpwuid(uid_t uid);
struct passwd *getpwnam(const char *name);
int getpwuid_r(uid_t uid, struct passwd *pwd, char *buf, size_t buflen, struct passwd **result);

#endif
