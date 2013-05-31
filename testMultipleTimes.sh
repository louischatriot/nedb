#!/usr/bin/env bash
set -e

for i in $(eval echo {1..$1})
do
  make test
done
