document.addEventListener("DOMContentLoaded", async () => {

    // play/pause button
    localStorage.inflames = localStorage.inflames !== false && localStorage.inflames !== "false"
    const button = document.getElementById("toggle-inflames");
    button.dataset.inflames = localStorage.inflames;
    button.onclick = () => {
        const inflames = localStorage.inflames === true || localStorage.inflames === "true";
        localStorage.inflames = !inflames;
        button.dataset.inflames = !inflames;
    };

    const canvas = document.getElementById("inflames");
    const gl = canvas.getContext("webgl", {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        desynchronized: true,
        powerPreference: "high-performance"
    });

    let width, height;
    function resize() {
        width = window.innerWidth;
        //height = window.innerHeight;
        height = 116 + 64;
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
    }
    window.addEventListener("resize", resize);
    resize();

    const vertexShaderSource = `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    let fragmentShaderSource = await (await fetch(`{$common}/res/shaders/inflames.glsl`)).text();

    if (window.location.href.indexOf("terminator") > -1) {
        fragmentShaderSource = fragmentShaderSource.replace(
            "vec3 fire = 1.25 * f * vec3(0.733, 0.635, 0.278);",
            "vec3 fire = 1.25 * f * vec3(0.733, 0.0, 0.0);"
            //"vec3 fire = 1.5*vec3(f, fff, fff*fff);"
        );
        fragmentShaderSource = fragmentShaderSource.replace(
            "sparks = sparkLife * sparksGray * vec3(0.733, 0.635, 0.278);",
            "sparks = sparkLife * sparksGray * vec3(0.733, 0.0, 0.0);"
        );        
    }

    function createShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    const positions = [
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    const iTimeLoc = gl.getUniformLocation(program, "iTime");
    const iResolutionLoc = gl.getUniformLocation(program, "iResolution");

    function render(time) {
        if (localStorage.inflames === true || localStorage.inflames === "true") {
            gl.uniform1f(iTimeLoc, time * 0.001);
            gl.uniform2f(iResolutionLoc, width, height);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

});