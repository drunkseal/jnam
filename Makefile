CC ?= gcc
CFLAGS ?= -O2 -Wall
LIBS = -ljack -lm -lpthread

all: bin/jnam-tuner bin/jnam-tone bin/jnam-metronome

bin/jnam-tuner: src/tuner.c
	@mkdir -p bin
	$(CC) $(CFLAGS) -o bin/jnam-tuner src/tuner.c $(LIBS)

bin/jnam-tone: src/tone.c
	@mkdir -p bin
	$(CC) $(CFLAGS) -o bin/jnam-tone src/tone.c $(LIBS)

bin/jnam-metronome: src/metronome.c
	@mkdir -p bin
	$(CC) $(CFLAGS) -o bin/jnam-metronome src/metronome.c $(LIBS)

clean:
	rm -f bin/jnam-tuner bin/jnam-tone bin/jnam-metronome

.PHONY: all clean
