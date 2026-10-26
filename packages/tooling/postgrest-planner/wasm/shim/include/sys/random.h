#ifndef SUPA_WASI_SYS_RANDOM_H
#define SUPA_WASI_SYS_RANDOM_H

#include_next <sys/random.h>
#include <stddef.h>
#include <sys/types.h>
#include <unistd.h>

#define GRND_NONBLOCK 1
#define GRND_RANDOM 2

/* wasi-libc only provides getentropy, which caps each request at 256 bytes. */
static inline ssize_t getrandom(void *buf, size_t len, unsigned int flags)
{
	(void) flags;
	if (len > 256)
		len = 256;
	if (getentropy(buf, len) != 0)
		return -1;
	return (ssize_t) len;
}

#endif
