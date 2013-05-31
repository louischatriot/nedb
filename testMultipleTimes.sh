#!/usr/bin/env bash

for i in $(eval echo {1..$1})
do
  make test
done
