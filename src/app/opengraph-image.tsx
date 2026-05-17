import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Shivam Lifestyle Accessories";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A0A0A",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          position: "relative",
          border: "4px solid #C9A84C",
          padding: "40px",
        }}
      >
        {/* Subtle decorative inner border */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            right: "20px",
            bottom: "20px",
            border: "1px solid rgba(201, 168, 76, 0.2)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Accent line top */}
          <div
            style={{
              width: "100px",
              height: "2px",
              background: "#C9A84C",
              marginBottom: "30px",
            }}
          />

          <span
            style={{
              fontSize: "20px",
              textTransform: "uppercase",
              letterSpacing: "0.4em",
              color: "#C9A84C",
              fontWeight: "bold",
              marginBottom: "15px",
            }}
          >
            ESTABLISHED IN INDIA
          </span>

          <h1
            style={{
              fontSize: "64px",
              fontWeight: "900",
              color: "#FFFFFF",
              textAlign: "center",
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              lineHeight: "1.2",
            }}
          >
            Shivam Lifestyle
          </h1>
          <h2
            style={{
              fontSize: "36px",
              fontWeight: "300",
              color: "#E5E5E5",
              textAlign: "center",
              margin: "5px 0 25px 0",
              textTransform: "uppercase",
              letterSpacing: "0.25em",
            }}
          >
            Accessories
          </h2>

          <div
            style={{
              width: "60px",
              height: "1px",
              background: "rgba(201, 168, 76, 0.4)",
              marginBottom: "20px",
            }}
          />

          <p
            style={{
              fontSize: "18px",
              color: "#A3A3A3",
              margin: 0,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Premium Hookah &amp; Lifestyle Accessories — India
          </p>

          <div
            style={{
              display: "flex",
              gap: "20px",
              marginTop: "25px",
              marginBottom: "15px",
            }}
          >
            {[
              "Free Shipping",
              "Premium Quality",
              "Pan India Delivery",
            ].map((tag, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: "12px",
                  color: "#C9A84C",
                  border: "1px solid rgba(201, 168, 76, 0.4)",
                  padding: "6px 14px",
                  borderRadius: "2px",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  fontWeight: "bold",
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          <div
            style={{
              position: "absolute",
              bottom: "40px",
              fontSize: "14px",
              color: "#C9A84C",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
            }}
          >
            shivamhookah.in
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
