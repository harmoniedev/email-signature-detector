pushd "%~dp0"
call yarn link
pushd ..\..\email-util
call bin\link.bat
popd

call yarn link @harmon.ie/email-util

popd