/* wasi-libc has no signal delivery: the sigset/sigaction API is declared and succeeds without effect. */
#ifndef SUPA_WASI_SIGNAL_H
#define SUPA_WASI_SIGNAL_H

#include_next <signal.h>
#include <__typedef_sigset_t.h>
#include <sys/types.h>

#ifdef __cplusplus
extern "C" {
#endif

#ifndef SIG_BLOCK
#define SIG_BLOCK 0
#define SIG_UNBLOCK 1
#define SIG_SETMASK 2
#endif

#ifndef SA_RESTART
#define SA_NOCLDSTOP 1
#define SA_NOCLDWAIT 2
#define SA_SIGINFO 4
#define SA_ONSTACK 0x08000000
#define SA_RESTART 0x10000000
#define SA_NODEFER 0x40000000
#define SA_RESETHAND 0x80000000
#endif

#ifndef SUPA_WASI_HAVE_SIGACTION
struct sigaction {
	union {
		void (*sa_handler)(int);
		void (*sa_sigaction)(int, void *, void *);
	} __sa_handler;
	sigset_t sa_mask;
	int sa_flags;
};
#define sa_handler __sa_handler.sa_handler
#define sa_sigaction __sa_handler.sa_sigaction
#endif

int sigemptyset(sigset_t *set);
int sigfillset(sigset_t *set);
int sigaddset(sigset_t *set, int signo);
int sigdelset(sigset_t *set, int signo);
int sigismember(const sigset_t *set, int signo);
int sigprocmask(int how, const sigset_t *restrict set, sigset_t *restrict old);
int pthread_sigmask(int how, const sigset_t *restrict set, sigset_t *restrict old);
int sigpending(sigset_t *set);
int sigwait(const sigset_t *restrict set, int *restrict sig);
int sigaction(int signo, const struct sigaction *restrict act, struct sigaction *restrict old);
int kill(pid_t pid, int sig);

#ifdef __cplusplus
}
#endif

#endif
