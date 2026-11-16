<?php
$o=file_get_contents($argv[1]); $j=json_decode($o,true); if(!$j){echo substr($o,0,2500);exit;}
echo ($j["result"]??"?")," tests=",$j["tests"]??0," passed=",$j["passed"]??0,"\n";
foreach(array_merge($j["error_details"]??[],$j["failure_details"]??[],$j["failures"]??[]) as $e){ echo "- ",substr($e["test"],-80),": ",substr($e["message"],0,300),"\n  @",basename($e["file"]??""),":",$e["line"]??"","\n"; }
