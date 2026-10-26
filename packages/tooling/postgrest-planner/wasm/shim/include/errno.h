/* WASI errno has no EHOSTDOWN; give it a distinct value so portable switch statements compile. */
#ifndef SUPA_WASI_ERRNO_H
#define SUPA_WASI_ERRNO_H

#include_next <errno.h>

#ifndef EHOSTDOWN
#define EHOSTDOWN 112
#endif

#endif
