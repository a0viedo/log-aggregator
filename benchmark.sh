#!/bin/bash

for file in "$@"
do
    IFS=',' read -r -a test_case <<< "$file"

    file="${test_case[1]}"
    printf "Running benchmarks for a ${test_case[0]}"

    printf "[${test_case[0]}][regex] Running benchmarks without keyword or selected lines"
    for i in {1..10}
    do
    time curl 'http://localhost:8080/api/grep/'$file 2> /dev/null > $i.txt
    rm $i.txt
    done

    printf "\n[${test_case[0]}][regex] Running benchmarks with a keyword"
    for i in {1..10}
    do
    time curl 'http://localhost:8080/api/regex/'$file'?keyword=cillum' 2> /dev/null > $i.txt
    rm $i.txt
    done

    printf "\n[${test_case[0]}][regex] Running benchmarks with a keyword and line selection"
    for i in {1..10}
    do
    time curl 'http://localhost:8080/api/regex/'$file'?keyword=cillum&last=2' 2> /dev/null > $i.txt
    rm $i.txt
    done

    printf "\n[${test_case[0]}][grep] Running benchmarks without a keyword or line selection"
    for i in {1..10}
    do
    time curl 'http://localhost:8080/api/grep/'$file 2> /dev/null > $i.txt
    rm $i.txt
    done

    printf "\n[${test_case[0]}][grep] Running benchmarks with a keyword"
    for i in {1..10}
    do
    time curl 'http://localhost:8080/api/regex/'$file'?keyword=cillum' 2> /dev/null > $i.txt
    rm $i.txt
    done

    printf "\n[${test_case[0]}][grep] Running benchmarks with a keyword and line selection"
    for i in {1..10}
    do
    time curl 'http://localhost:8080/api/regex/'$file'?keyword=cillum&last=2' 2> /dev/null > $i.txt
    rm $i.txt
    done

done
