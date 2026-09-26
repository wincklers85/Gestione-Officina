FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    OPENMVS_BIN=/usr/local/bin \
    PHOTOGRAMMETRY_THREADS=4 \
    QT_QPA_PLATFORM=offscreen

# OpenMVS is built without CUDA. Its CPU SGM path provides dense reconstruction
# on Render's standard CPU worker; COLMAP is used for the sparse camera solve.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake git pkg-config \
      colmap python3 python3-pil \
      libboost-iostreams-dev libboost-program-options-dev libboost-system-dev libboost-serialization-dev \
      libceres-dev libcgal-dev libeigen3-dev libopencv-dev \
      libjpeg-dev libpng-dev libtiff-dev libsqlite3-dev libgoogle-glog-dev libsuitesparse-dev \
      libglew-dev libglfw3-dev freeglut3-dev libxi-dev libxinerama-dev libxcursor-dev libxxf86vm-dev \
  && git clone --depth 1 https://github.com/cdcseacave/VCG.git /opt/vcglib \
  && git clone --depth 1 --branch v2.4.0 https://github.com/cdcseacave/openMVS.git /opt/openMVS \
  && cmake -S /opt/openMVS -B /opt/openMVS-build \
       -DCMAKE_BUILD_TYPE=Release \
       -DCMAKE_INSTALL_PREFIX=/usr/local \
       -DVCG_ROOT=/opt/vcglib \
       -DOpenMVS_USE_CUDA=OFF \
       -DOpenMVS_BUILD_VIEWER=OFF \
  && cmake --build /opt/openMVS-build --parallel 2 \
  && cmake --install /opt/openMVS-build \
  && ldconfig \
  && colmap help >/dev/null \
  && for executable in InterfaceCOLMAP DensifyPointCloud ReconstructMesh RefineMesh TextureMesh TransformScene; do \
       test -x "/usr/local/bin/$executable"; \
     done \
  && rm -rf /opt/openMVS /opt/openMVS-build /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
CMD ["node", "src/reconstruction-worker.js"]
