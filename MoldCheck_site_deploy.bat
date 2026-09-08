@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"
title MoldCheck 판매 사이트 배포 v2
set REPO=https://github.com/LeeJaeHaeng/moldcheck-site.git

echo.
echo  ==========================================
echo   MoldCheck 판매 사이트 -^> GitHub Pages
echo  ==========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo  [X] Git 이 설치되어 있지 않습니다.
  echo      https://git-scm.com/download/win  설치 후 다시 실행하세요.
  goto :fail
)
if not exist "index.html" (
  echo  [X] index.html 이 없습니다. 이 파일은 MoldCheck_site 폴더 안에서 실행해야 합니다.
  goto :fail
)

echo  [1/6] 저장소 준비
if not exist ".git" (
  git init
  git symbolic-ref HEAD refs/heads/main
) else (
  echo      기존 저장소를 그대로 사용합니다.
)

echo  [2/6] 사용자 정보 확인
for /f "delims=" %%i in ('git config user.email 2^>nul') do set GEMAIL=%%i
for /f "delims=" %%i in ('git config user.name 2^>nul') do set GNAME=%%i
if "!GEMAIL!"=="" (
  echo      user.email 이 없어 임시로 설정합니다.
  git config user.email "tigermb13488@gmail.com"
)
if "!GNAME!"=="" (
  echo      user.name 이 없어 임시로 설정합니다.
  git config user.name "LeeJaeHaeng"
)

echo  [3/6] 파일 등록
git add -A
if errorlevel 1 ( echo  [X] git add 실패 & goto :fail )

echo  [4/6] 커밋
git commit -m "MoldCheck 판매 사이트 배포"
rem 변경 없음(exit 1)은 정상. 커밋이 하나라도 있는지로 판정한다.
git rev-parse --verify HEAD >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [X] 커밋이 하나도 만들어지지 않았습니다. 바로 위의 git 메시지를 확인하세요.
  goto :fail
)

echo  [5/6] 브랜치 이름을 main 으로 통일
git branch -M main
for /f "delims=" %%i in ('git rev-parse --abbrev-ref HEAD') do set BR=%%i
echo      현재 브랜치: !BR!

echo  [6/6] GitHub 로 업로드
git remote remove origin >nul 2>nul
git remote add origin %REPO%
git push -u origin main --force
if errorlevel 1 goto :pushfail

echo.
echo  ==========================================
echo   업로드 완료.
echo.
echo   최초 1회만 - Pages 켜기:
echo     Source = Deploy from a branch  /  Branch = main  /  (root)  -^> Save
echo.
echo     1~2분 뒤:  https://leejaehaeng.github.io/moldcheck-site/
echo  ==========================================
start "" https://github.com/LeeJaeHaeng/moldcheck-site/settings/pages
goto :end

:pushfail
echo.
echo  [X] 업로드 실패. 위의 빨간 메시지를 그대로 보고 판단하세요.
echo.
echo   자주 나오는 원인:
echo    - "Repository not found"  -^> GitHub 에 저장소가 아직 없습니다.
echo         https://github.com/new  ->  이름 moldcheck-site  ->  Public  ->  Create
echo         (README / .gitignore / license 체크박스는 모두 해제)
echo    - "Authentication failed" -^> 로그인 창에서 GitHub 계정으로 로그인하세요.
echo    - "Permission denied"     -^> 다른 계정으로 로그인되어 있습니다.
echo         제어판 -^> 자격 증명 관리자 -^> Windows 자격 증명 -^> git:https://github.com 삭제 후 재실행
echo.
start "" https://github.com/new
goto :fail

:fail
echo.
pause
exit /b 1

:end
echo.
pause
