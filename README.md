# Rock Lab Classroom

암석 3D 관찰과 공통 3문항 보고서를 위한 학습 사이트입니다. 학생은 Google로 로그인하고 시료를 자유롭게 이동하며 답변을 자동 저장합니다. 모든 활성 시료의 3문항을 작성해야 제출할 수 있고, 수정 후 다시 제출할 수 있습니다. 교사는 접근 코드로 들어와 시료 순서와 문항을 관리하고 최근 제출본을 확인합니다.

## 현재 미리보기

Supabase 환경 변수가 없으면 브라우저에만 저장되는 시연 모드가 실행됩니다. 학생과 교사 미리보기는 같은 브라우저에서만 데이터를 공유합니다. 학생 정보와 답변을 실제 수업에 사용하지 마세요. 교사 미리보기 코드는 `VITE_PREVIEW_TEACHER_CODE`로 빌드할 때만 지정합니다.

## 실제 수업 연결

1. 이 사이트 전용 Supabase 프로젝트를 만듭니다.
2. SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql)을 한 번 실행합니다. 교사 접근 코드는 별도로 설정하며 공개 저장소에 기록하지 않습니다.
3. Authentication에서 Google 제공자와 Anonymous Sign-Ins를 켭니다. Google OAuth 승인된 리디렉션 URI는 Supabase의 `/auth/v1/callback` 주소를 사용합니다. Supabase URL Configuration에 실제 사이트 주소를 등록합니다.
4. Vercel 환경 변수에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를 설정합니다. Supabase의 **publishable/anon 키**만 사용하고 service role 키는 브라우저에 넣지 않습니다. 실제 배포에는 `VITE_PREVIEW_TEACHER_CODE`를 설정하지 않습니다.
5. 배포 후 Google 로그인, 학생 본인 답변 접근, 교사 전체 조회와 시료 순서 변경을 실제 계정으로 확인합니다.

## 마감과 채점 기능

기본 스키마를 실행한 프로젝트는 SQL Editor에서 [`supabase/grading.sql`](supabase/grading.sql)을 추가로 한 번 실행합니다. 교사는 대시보드에서 한국 시간 기준 마감 시각과 시료별 만점(기본 3점)을 설정하고, 제출된 시료별 점수와 피드백을 저장할 수 있습니다. 마감 후에는 학생의 자동 저장과 최종 제출을 데이터베이스에서도 차단합니다. 점수와 피드백은 교사가 결과를 공개한 뒤에만 학생에게 보입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

GitHub에는 이 폴더만 별도 저장소로 올립니다. 공개 저장소에는 교사 코드와 학생에게 숨길 시료의 실제 이름을 넣지 않습니다. Vercel에서 해당 저장소를 가져오면 프로젝트 루트는 저장소 최상위 폴더, 빌드 명령은 `npm run build`, 출력 디렉터리는 `dist`입니다. 이후에는 이 폴더의 소스를 수정하고 GitHub에 반영하면 Vercel이 새 버전을 배포합니다. 지금의 임시 사이트는 전환을 확인할 때까지만 미리보기로 유지합니다.

현재 예시 모델은 `public/models`에 포함되어 GitHub/Vercel의 정적 파일로 제공됩니다. 최종 11개 모델도 이 방식으로 배포합니다. 교사 화면에서는 시료 순서와 공개 상태를 관리하고, 새 GLB 파일은 소스에 추가해 배포합니다. 학생에게 노출될 수 있는 파일명과 내부 이름·메타데이터는 등록 전에 제거해야 합니다. 모델 원본의 이용 조건과 필요한 출처 표기는 별도로 확인해야 합니다.
