CC ?= gcc
CFLAGS ?= -O2 -Wall
LIBS = -ljack -lm

all: bin/jnam-tuner bin/jnam-tone

bin/jnam-tuner: src/tuner.c
	@mkdir -p bin
	$(CC) $(CFLAGS) -o bin/jnam-tuner src/tuner.c $(LIBS)

bin/jnam-tone: src/tone.c
	@mkdir -p bin
	$(CC) $(CFLAGS) -o bin/jnam-tone src/tone.c $(LIBS)

clean:
	rm -f bin/jnam-tuner bin/jnam-tone

.PHONY: all clean
