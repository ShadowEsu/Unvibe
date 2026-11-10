# Sample code for an Unvibe demo. Not from a real project.
import random
import time

start = time.time()
do_lookup()
elapsed_ms = int((time.time() - start) * 1000)
delay = random.randrange(elapsed_ms)
