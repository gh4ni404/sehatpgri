const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx3ePivwTn2qoyJFNv13vkUXXPnMQi3X_h1_8qJLl82xr75mROXjvOotXR70h0ovm6aGA/exec";

      const form = document.getElementById("formPendaftaran");
      const merah = document.getElementById("status-merah");
      const hijau = document.getElementById("status-hijau");

      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const data = {
          nik: document.getElementById("nik").value,
          nama: document.getElementById("nama").value,
          pekerjaan: document.getElementById("kategori").value,
          instansi: document.getElementById("instansi").value,
          telepon: document.getElementById("telepon").value,
          alamat: document.getElementById("alamat").value,
        };

        merah.classList.add("hidden");
        hijau.classList.remove("hidden");

        try {
          const res = await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

          alert("✅ Pendaftaran berhasil dikirim!");
          form.reset();
        } catch (err) {
          alert("❌ Gagal mengirim data. Coba lagi nanti.");
          console.error(err);
        }

        setTimeout(() => {
          hijau.classList.add("hidden");
          merah.classList.remove("hidden");
        }, 3000);
      });