# ENSIL 목업 펌웨어 (ESP32, PlatformIO)

`src/main.cpp` 하나를 `-DUNIT=n` 으로 갈라 세 목업에 올린다. 네트워크·핀은 `include/config.h`.

```
pio run -e unit1 -t upload   # NO.01 십자형   스위치 → 네오픽셀 17구   (기본 AP 호스트)
pio run -e unit2 -t upload   # NO.02 텐던     PIR → 서보
pio run -e unit3 -t upload   # NO.03 스피커   카메라 → 앰프 (sense/act 에 기존 코드 이식)
pio device monitor
```

각 보드에서 손댈 곳은 `sense()`(감지된 순간에 한 번 true)와 `act(intensity)`(동작) 두 함수뿐이다.
브릿지가 없어도 센싱→동작은 그대로 되고, 브릿지가 뜨면 `trigger` 가 올라가 아이맥이 해당 개체 아카이브를 띄운다.
웹에서 `act` 가 오면 같은 `act()` 가 실행된다.

구성·현장 절차는 `docs/EXHIBITION_SETUP.md` §6.
