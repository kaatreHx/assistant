import React from "react";
import { useNavigate } from "react-router-dom";

function CBTDashboard() {
  const navigate = useNavigate();
  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Welcome to CBT Companion</h1>

      <div style={styles.options}>
        <div style={styles.card} onClick={() => navigate("/chat")}> 
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="#4a90e2"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M20 2H4C2.897 2 2 2.897 2 4V18C2 19.103 2.897 20 4 20H18L22 24V4C22 2.897 21.103 2 20 2Z" />
          </svg>
          <p style={styles.label}>Chat with CBT</p>
        </div>

        <div style={styles.card} onClick={() => navigate("/voice")}> 
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="#4caf50"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 14C13.654 14 15 12.654 15 11V5C15 3.346 13.654 2 12 2S9 3.346 9 5V11C9 12.654 10.346 14 12 14ZM19 11C19 14.309 16.309 17 13 17H11C7.691 17 5 14.309 5 11H3C3 15.065 6.134 18.449 10 18.938V22H14V18.938C17.866 18.449 21 15.065 21 11H19Z" />
          </svg>
          <p style={styles.label}>Voice with CBT</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "40px 20px",
    textAlign: "center",
    fontFamily: "Arial, sans-serif",
  },
  heading: {
    marginBottom: "30px",
    fontSize: "28px",
    color: "#333",
  },
  options: {
    display: "flex",
    justifyContent: "center",
    gap: "40px",
    flexWrap: "wrap",
  },
  card: {
    background: "#f9f9f9",
    padding: "20px",
    borderRadius: "15px",
    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
    width: "160px",
    cursor: "pointer",
    transition: "transform 0.2s",
  },
  label: {
    marginTop: "10px",
    fontSize: "16px",
    fontWeight: "bold",
  },
};

export default CBTDashboard;
