#!/usr/bin/env bash
# Builds a client-only static libpq for wasm32-wasi from the PostgreSQL source tarball.
# Output: $OUT/{lib/libpq.a,include/*,lib/pkgconfig/libpq.pc}
#
# Vendored from supabase/supa-wasm postgrest/libpq/build.sh at a44d72062f00392fb79223fbbc272de4299c1c9d. The only
# change: the toolchain, source and output directories come from the caller (../../build.sh) instead of supa-wasm's tree.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
POSTGREST_DIR=$(cd "$HERE/.." && pwd)

PG_VERSION=17.11
PG_SHA256=dd27f2b3c59e73ed14aa3324901242bf69a032a6347805f274e6260322d42979
PG_URL="https://ftp.postgresql.org/pub/source/v$PG_VERSION/postgresql-$PG_VERSION.tar.bz2"

: "${GHC_WASM:?}" "${PGSRC_ROOT:?}" "${LIBPQ_OUT:?}"
SRC_ROOT=$PGSRC_ROOT
OUT=$LIBPQ_OUT
SHIM=$POSTGREST_DIR/shim

export PATH="$GHC_WASM/bin:$PATH"
SRC=$SRC_ROOT/postgresql-$PG_VERSION
BUILD=$SRC_ROOT/build-$PG_VERSION
CC=wasm32-wasi-clang
AR=llvm-ar
RANLIB=llvm-ranlib

mkdir -p "$SRC_ROOT" "$OUT/lib/pkgconfig" "$OUT/include/libpq"

# Everything that shapes libpq.a: this script (version and flags), the source patches, and the shim
# sources and headers. A change to any of them rebuilds from a fresh extraction; REBUILD_LIBPQ=1 forces it.
STAMP=$(cd "$POSTGREST_DIR" && find libpq/build.sh libpq/patches shim/include shim/src/supa_wasi_shim.c shim/src/supa_net_import.c -type f |
	LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -d' ' -f1)
if [ -z "${REBUILD_LIBPQ:-}" ] && [ -f "$OUT/lib/libpq.a" ] && [ "$(cat "$OUT/.stamp" 2>/dev/null)" = "$STAMP" ]; then
	echo "libpq up to date: $OUT/lib/libpq.a"
	exit 0
fi
rm -f "$OUT/.stamp"

tarball=$SRC_ROOT/postgresql-$PG_VERSION.tar.bz2
[ -f "$tarball" ] || curl -fsSL -o "$tarball" "$PG_URL"
echo "$PG_SHA256  $tarball" | shasum -a 256 -c -
rm -rf "$SRC" "$BUILD"
tar -C "$SRC_ROOT" -xjf "$tarball"
for p in "$HERE"/patches/*.patch; do
	patch -d "$SRC" -p1 -s < "$p"
done

CFLAGS="-O2 -fPIC -mcpu=lime1 -mreference-types -msimd128 -fno-strict-aliasing -fwrapv -Wno-unused-command-line-argument -Wno-compound-token-split-by-macro"
CFLAGS="$CFLAGS -D_GNU_SOURCE -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS -D_WASI_EMULATED_MMAN -D_WASI_EMULATED_GETPID"

mkdir -p "$BUILD"
if [ ! -f "$BUILD/src/include/pg_config.h" ]; then
	(cd "$BUILD" && CC=$CC CFLAGS="$CFLAGS" "$SRC/configure" --host=wasm32-wasi --with-template=linux \
		--without-readline --without-zlib --without-icu --without-openssl --without-gssapi \
		--disable-spinlocks --without-ldap --without-pam --without-libxml --without-libxslt \
		> configure.out 2>&1) || { tail -30 "$BUILD/configure.out"; exit 1; }
fi
make -s -C "$BUILD/src/port" pg_config_paths.h > "$BUILD/paths.out" 2>&1 || { cat "$BUILD/paths.out"; exit 1; }

INC="-I$SHIM/include -I$SRC/src/interfaces/libpq -I$BUILD/src/interfaces/libpq -I$SRC/src/include -I$BUILD/src/include -I$SRC/src/port -I$BUILD/src/port"
OBJ=$BUILD/wasm-obj
rm -rf "$OBJ"
mkdir -p "$OBJ"

LIBPQ_SRCS="fe-auth-scram fe-cancel fe-connect fe-exec fe-lobj fe-misc fe-protocol3 fe-secure fe-trace legacy-pqsignal libpq-events pqexpbuffer fe-auth"
COMMON_SRCS="base64 cryptohash encnames fe_memutils hmac ip md5 md5_common pg_prng saslprep scram-common sha1 sha2 string stringinfo unicode_norm wchar link-canary"
PORT_SRCS="chklocale inet_net_ntop noblock pg_strong_random pgstrcasecmp pqsignal snprintf strerror pgsleep pg_bitutils pgcheckdir qsort qsort_arg bsearch_arg quotes path user getpeereid timingsafe_bcmp"

compile() { # dir name extra-cflags
	$CC $CFLAGS $3 -DFRONTEND $INC -c "$SRC/src/$1/$2.c" -o "$OBJ/$(basename "$1")-$2.o"
}
for f in $LIBPQ_SRCS; do compile interfaces/libpq "$f" ""; done
for f in $COMMON_SRCS; do compile common "$f" ""; done
for f in $PORT_SRCS; do compile port "$f" ""; done
$CC $CFLAGS -I"$SHIM/include" -c "$SHIM/src/supa_wasi_shim.c" -o "$OUT/supa_wasi_shim.o"

# Host import object for final links (see the file header) and an empty libpq.so that satisfies
# the Template Haskell loader's lookup of the extra-library; it is kept out of lib/ so static
# links pick libpq.a.
$CC $CFLAGS -c "$SHIM/src/supa_net_import.c" -o "$OUT/supa_net_import.o"
mkdir -p "$OUT/lib-th"
echo 'void _initialize(void) {}' > "$OUT/lib-th/stub.c"
$CC -fPIC -shared -nostdlib -Wl,--no-entry,--export=_initialize -o "$OUT/lib-th/libpq.so" "$OUT/lib-th/stub.c"
rm -f "$OUT/lib-th/stub.c"

rm -f "$OUT/lib/libpq.a" "$OUT/lib/libsupa_wasi.a"
$AR crs "$OUT/lib/libpq.a" "$OBJ"/*.o "$OUT/supa_wasi_shim.o"
rm -f "$OUT/supa_wasi_shim.o"
$RANLIB "$OUT/lib/libpq.a"

cp "$SRC/src/interfaces/libpq/libpq-fe.h" "$SRC/src/interfaces/libpq/libpq-events.h" "$OUT/include/"
cp "$SRC/src/include/libpq/libpq-fs.h" "$OUT/include/libpq/"
cp "$BUILD/src/include/pg_config.h" "$BUILD/src/include/pg_config_ext.h" "$SRC/src/include/postgres_ext.h" "$OUT/include/"
cat > "$OUT/lib/pkgconfig/libpq.pc" <<PC
prefix=$OUT
libdir=\${prefix}/lib
includedir=\${prefix}/include

Name: libpq
Description: PostgreSQL client library (wasm32-wasi)
Version: $PG_VERSION
Libs: -L\${libdir} -lpq
Cflags: -I\${includedir}
PC
mkdir -p "$OUT/bin"
cat > "$OUT/bin/pg_config" <<'PGC'
#!/bin/sh
D=$(cd "$(dirname "$0")/.." && pwd)
case "$1" in
	--includedir) echo "$D/include" ;;
	--libdir) echo "$D/lib" ;;
	--version) echo "PostgreSQL 17.11" ;;
	--libs|--ldflags|--ldflags_ex|--ldflags_sl) echo "" ;;
	*) echo "pg_config: unsupported option $1" >&2; exit 1 ;;
esac
PGC
chmod +x "$OUT/bin/pg_config"
echo "$STAMP" > "$OUT/.stamp"
echo "libpq built: $OUT/lib/libpq.a"
