# dream-international-center
## 로컬 관리자 서버

PowerShell에서 `./start-admin.ps1`을 실행하고 관리자 비밀번호를 입력합니다.
[관리자 페이지](http://127.0.0.1:8766/admin.html)에서 회원 등록, 승급, 삭제 및 활동사진 등록을 할 수 있습니다.

회원 정보와 활동사진은 실행 폴더의 `activity-data/`에 저장됩니다.
정적 호스팅에서는 관리자 및 회원 기능에 필요한 Node.js 서버가 실행되지 않습니다.
