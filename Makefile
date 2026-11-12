CC ?= gcc
CFLAGS ?= -O2 -Wall
LIBS = -ljack -lm

all: bin/jnam-tuner

bin/jnam-tuner: src/tuner.c
	@mkdir -p bin
	$(CC) $(CFLAGS) -o bin/jnam-tuner src/tuner.c $(LIBS)

clean:
	rm -f bin/jnam-tuner

.PHONY: all clean
