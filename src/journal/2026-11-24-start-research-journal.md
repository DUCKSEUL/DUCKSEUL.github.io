---
title: 연구 일지를 시작합니다
date: 2026-11-24
tags: [공지, 가이드]
summary: 이 공간을 어떻게 쓸지, 그리고 일지를 어떤 형식으로 작성하는지 정리했어요.
---

연구를 하다 보면 **왜 그렇게 결정했는지**, **무엇이 안 됐는지**가 가장 빨리 잊힙니다.
이 일지는 결과뿐 아니라 그 과정을 남기기 위한 공간이에요.

## 무엇을 기록하나요

- 수치해석 코드의 구현 과정과 디버깅 기록
- 시뮬레이션 결과와 해석
- 읽은 논문 요약과 메모
- AI 도구를 연구에 활용하며 얻은 팁

## 작성 형식 미리보기

일지는 Markdown으로 작성하고, 수식·표·코드를 모두 쓸 수 있어요.

### 수식

인라인 수식은 `$...$`로 씁니다. 예를 들어 자유공간 그린 함수는
$G(\mathbf{r},\mathbf{r}') = e^{-jkR}/(4\pi R)$ 이고, $R = |\mathbf{r}-\mathbf{r}'|$ 입니다.

블록 수식은 `$$...$$`로 씁니다. 완전 도체 표면에 대한 전기장 적분방정식(EFIE)은 다음과 같아요.

$$
\hat{n} \times \mathbf{E}^{\mathrm{inc}}(\mathbf{r})
= \hat{n} \times j\omega\mu \int_S \left[ \mathbf{J}(\mathbf{r}')
+ \frac{1}{k^2} \nabla \left( \nabla' \cdot \mathbf{J}(\mathbf{r}') \right) \right]
G(\mathbf{r},\mathbf{r}')\, dS'
$$

### 표

| 항목 | 설명 |
| --- | --- |
| 기저 함수 | RWG |
| 시험 함수 | Galerkin |
| 행렬 풀이 | 직접법 / 반복법 |

### 코드

```matlab
% 예시: 임피던스 행렬 채우기 골격
Z = zeros(N, N);
for m = 1:N
    for n = 1:N
        Z(m, n) = integrate_pair(edges(m), edges(n), k);
    end
end
I = Z \ V;
```

### 체크리스트

- [x] 연구 일지 공간 만들기
- [ ] 첫 번째 실험 기록 남기기

> 꾸준함이 재능을 이긴다. 하루에 한 줄이라도 남겨보려고 합니다.
