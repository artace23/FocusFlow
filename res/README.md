# App icons

`config.xml` references Android launcher icons at these paths. Add your own PNGs here before building for release:

```
res/android/icon-ldpi.png    (36x36)
res/android/icon-mdpi.png    (48x48)
res/android/icon-hdpi.png    (72x72)
res/android/icon-xhdpi.png   (96x96)
res/android/icon-xxhdpi.png  (144x144)
res/android/icon-xxxhdpi.png (192x192)
```

A simple way to generate the full set from one 1024x1024 source image is `cordova-res` (`npm install -g cordova-res`, then `cordova-res android --skip-config --copy`).
