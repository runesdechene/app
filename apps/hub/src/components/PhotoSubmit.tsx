import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import "./PublicForm.css";

const MAX_MESSAGE_LENGTH = 500;
const MAX_FILES = 5;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES = "image/*,video/*";

const isVideo = (file: File) => file.type.startsWith("video/");
const isImage = (file: File) => file.type.startsWith("image/");
const isMediaFile = (file: File) => isImage(file) || isVideo(file);
const maxSizeFor = (file: File) =>
  isVideo(file) ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

type SubmitterRole = "client" | "ambassadeur" | "partenaire";

const ROLE_LABELS: Record<SubmitterRole, string> = {
  client: "Client",
  ambassadeur: "Ambassadeur",
  partenaire: "Partenaire",
};

interface FormData {
  name: string;
  email: string;
  instagram: string;
  locationName: string;
  locationZip: string;
  message: string;
  submitterRole: SubmitterRole;
  productSize: string;
  modelHeightCm: string;
  modelShoulderWidthCm: string;
  consentBrand: boolean;
  consentAccount: boolean;
}

type SubmitStep = "form" | "uploading" | "success" | "error";

export function PhotoSubmit() {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    instagram: "",
    locationName: "",
    locationZip: "",
    message: "",
    submitterRole: "client" as SubmitterRole,
    productSize: "",
    modelHeightCm: "",
    modelShoulderWidthCm: "",
    consentBrand: false,
    consentAccount: false,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [step, setStep] = useState<SubmitStep>("form");
  const [progress, setProgress] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isNewAccount, setIsNewAccount] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter((f) => {
      if (!isMediaFile(f)) return false;
      if (f.size > maxSizeFor(f)) return false;
      return true;
    });

    const total = [...files, ...valid].slice(0, MAX_FILES);
    setFiles(total);

    const newPreviews: string[] = [];
    total.forEach((file) => {
      const url = URL.createObjectURL(file);
      newPreviews.push(url);
    });
    previews.forEach((p) => URL.revokeObjectURL(p));
    setPreviews(newPreviews);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const isValid = () => {
    return (
      form.name.trim() !== "" &&
      form.email.trim() !== "" &&
      form.email.includes("@") &&
      files.length > 0 &&
      form.consentBrand &&
      form.consentAccount
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid()) return;

    setStep("uploading");
    setErrorMsg("");

    try {
      setProgress("Verification du compte...");
      const { data: existingUsers } = await supabase
        .from("users")
        .select("id")
        .eq("email_address", form.email.toLowerCase().trim())
        .limit(1);

      let userId: string;
      setIsNewAccount(false);

      if (existingUsers && existingUsers.length > 0) {
        userId = existingUsers[0].id;
        const updates: Record<string, string> = {};
        if (form.instagram.trim()) updates.instagram = form.instagram.trim();
        if (form.locationName.trim())
          updates.location_name = form.locationName.trim();
        if (form.locationZip.trim())
          updates.location_zip = form.locationZip.trim();
        if (Object.keys(updates).length > 0) {
          await supabase.from("users").update(updates).eq("id", userId);
        }
      } else {
        setIsNewAccount(true);
        setProgress("Creation du compte...");
        const newId = crypto.randomUUID();
        const { error: insertError } = await supabase.rpc(
          "create_user_from_submission",
          {
            p_id: newId,
            p_email: form.email.toLowerCase().trim(),
            p_first_name: form.name.trim().split(" ")[0] || form.name.trim(),
            p_last_name: form.name.trim().split(" ").slice(1).join(" ") || "",
            p_instagram: form.instagram.trim() || null,
            p_location_name: form.locationName.trim() || null,
            p_location_zip: form.locationZip.trim() || null,
          },
        );

        if (insertError)
          throw new Error(`Erreur creation compte: ${insertError.message}`);
        userId = newId;
      }

      setProgress("Enregistrement de la soumission...");
      const { data: submissionId, error: subError } = await supabase.rpc(
        "create_photo_submission",
        {
          p_user_id: userId,
          p_submitter_name: form.name.trim(),
          p_submitter_email: form.email.toLowerCase().trim(),
          p_submitter_instagram: form.instagram.trim() || null,
          p_location_name: form.locationName.trim() || null,
          p_location_zip: form.locationZip.trim() || null,
          p_message: form.message.trim() || null,
          p_consent_brand: form.consentBrand,
          p_consent_account: form.consentAccount,
          p_submitter_role: form.submitterRole,
          p_product_size: form.productSize.trim() || null,
          p_model_height_cm: form.modelHeightCm
            ? parseFloat(form.modelHeightCm)
            : null,
          p_model_shoulder_width_cm: form.modelShoulderWidthCm
            ? parseFloat(form.modelShoulderWidthCm)
            : null,
        },
      );

      if (subError) throw new Error(`Erreur soumission: ${subError.message}`);

      for (let i = 0; i < files.length; i++) {
        setProgress(`Upload fichier ${i + 1}/${files.length}...`);
        const file = files[i];
        const ext = file.name.split(".").pop() || "jpg";
        const storagePath = `submissions/${submissionId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("community-photos")
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError)
          throw new Error(
            `Erreur upload fichier ${i + 1}: ${uploadError.message}`,
          );

        const { data: urlData } = supabase.storage
          .from("community-photos")
          .getPublicUrl(storagePath);

        const { error: imgError } = await supabase.rpc("add_submission_image", {
          p_submission_id: submissionId,
          p_storage_path: storagePath,
          p_image_url: urlData.publicUrl,
          p_sort_order: i,
        });

        if (imgError)
          throw new Error(`Erreur enregistrement fichier: ${imgError.message}`);
      }

      setStep("success");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Une erreur est survenue",
      );
      setStep("error");
    }
  };

  const resetForm = () => {
    previews.forEach((p) => URL.revokeObjectURL(p));
    setForm({
      name: "",
      email: "",
      instagram: "",
      locationName: "",
      locationZip: "",
      message: "",
      submitterRole: "client",
      productSize: "",
      modelHeightCm: "",
      modelShoulderWidthCm: "",
      consentBrand: false,
      consentAccount: false,
    });
    setFiles([]);
    setPreviews([]);
    setStep("form");
    setErrorMsg("");
    setProgress("");
  };

  if (step === "success") {
    return (
      <div className="submit-page">
        <div className="submit-card success-card">
          <div className="success-icon">✓</div>
          <h2>Merci pour votre contribution !</h2>
          <p>
            Vos photos ont ete envoyees avec succes. Elles seront examinees par
            notre equipe avant publication.
          </p>
          <div className="account-info-box">
            {isNewAccount ? (
              <p>
                Felicitations, votre adresse email <strong>{form.email}</strong>{" "}
                a permis la creation d'un compte <strong>Runes de Chene</strong>
                . Vous pouvez l'utiliser sur l'application{" "}
                <strong>Carte</strong> pour connecter avec la communaute.
              </p>
            ) : (
              <p>
                Votre adresse email <strong>{form.email}</strong> est deja
                associee a un compte <strong>Runes de Chene</strong>. Vos photos
                ont ete rattachees a votre compte. Retrouvez la communaute sur
                l'application <strong>Carte</strong>.
              </p>
            )}
          </div>
          <button onClick={resetForm} className="btn-primary">
            Envoyer d'autres photos
          </button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="submit-page">
        <div className="submit-card error-card">
          <div className="error-icon">✕</div>
          <h2>Oups, une erreur est survenue</h2>
          <p>{errorMsg}</p>
          <button onClick={() => setStep("form")} className="btn-primary">
            Reessayer
          </button>
        </div>
      </div>
    );
  }

  if (step === "uploading") {
    return (
      <div className="submit-page">
        <div className="submit-card uploading-card">
          <div className="spinner" />
          <p>{progress}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="submit-page">
      <div className="back-button-container">
        <a href="https://runesdechene.com/pages/ils-nous-portent" className="back-button">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Retour boutique
        </a>
      </div>
      <div className="submit-header">
        <img src="/assets/drapeau.svg" alt="Runes de Chêne" className="header-logo" />
        <h1>Partagez vos photos</h1>
        <p>Runes de Chêne — Communauté</p>
      </div>

      <form className="submit-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Nom *</label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Votre nom"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email *</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="votre@email.com"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="instagram">
            Instagram <span className="optional">(optionnel)</span>
          </label>
          <input
            id="instagram"
            type="text"
            value={form.instagram}
            onChange={(e) => updateField("instagram", e.target.value)}
            placeholder="@votre_compte"
          />
        </div>

        <div className="form-group">
          <label htmlFor="locationName">
            Ville <span className="optional">(optionnel)</span>
          </label>
          <input
            id="locationName"
            type="text"
            value={form.locationName}
            onChange={(e) => updateField("locationName", e.target.value)}
            placeholder="Votre ville"
          />
        </div>

        <div className="form-group">
          <label htmlFor="locationZip">
            Code postal <span className="optional">(optionnel)</span>
          </label>
          <input
            id="locationZip"
            type="text"
            value={form.locationZip}
            onChange={(e) => updateField("locationZip", e.target.value)}
            placeholder="75000"
          />
        </div>

        <div className="form-group">
          <label htmlFor="productSize">
            Taille du produit porte{" "}
            <span className="optional">(optionnel)</span>
          </label>
          <select
            id="productSize"
            value={form.productSize}
            onChange={(e) => updateField("productSize", e.target.value)}
          >
            <option value="">-- Selectionnez --</option>
            <option value="XS">XS</option>
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L">L</option>
            <option value="XL">XL</option>
            <option value="XXL">XXL</option>
            <option value="3XL">3XL</option>
            <option value="4XL">4XL</option>
            <option value="5XL">5XL</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="modelHeightCm">
            Hauteur du modele en cm{" "}
            <span className="optional">(optionnel)</span>
          </label>
          <input
            id="modelHeightCm"
            type="number"
            value={form.modelHeightCm}
            onChange={(e) => updateField("modelHeightCm", e.target.value)}
            placeholder="175"
            min="100"
            max="250"
          />
        </div>

        <div className="form-group">
          <label htmlFor="modelShoulderWidthCm">
            Largeur d'epaule en cm <span className="optional">(optionnel)</span>
          </label>
          <input
            id="modelShoulderWidthCm"
            type="number"
            value={form.modelShoulderWidthCm}
            onChange={(e) =>
              updateField("modelShoulderWidthCm", e.target.value)
            }
            placeholder="45"
            min="20"
            max="80"
          />
        </div>

        <div className="form-group">
          <label htmlFor="submitterRole">Vous etes *</label>
          <select
            id="submitterRole"
            value={form.submitterRole}
            onChange={(e) => updateField("submitterRole", e.target.value)}
          >
            {(Object.keys(ROLE_LABELS) as SubmitterRole[]).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>
            Photos / Videos *{" "}
            <span className="optional">
              (max {MAX_FILES} — photos 10 Mo, videos 50 Mo)
            </span>
          </label>

          <div
            className="photo-upload-area"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              onChange={handleFiles}
              style={{ display: "none" }}
            />
            <div className="upload-placeholder">
              <span className="upload-icon">📷</span>
              <span>Cliquez pour ajouter des photos ou videos</span>
            </div>
          </div>

          {previews.length > 0 && (
            <div className="photo-previews">
              {previews.map((src, i) => (
                <div key={i} className="preview-item">
                  {isVideo(files[i]) ? (
                    <video src={src} muted playsInline />
                  ) : (
                    <img src={src} alt={`Photo ${i + 1}`} />
                  )}
                  {isVideo(files[i]) && (
                    <span className="preview-video-badge">VIDEO</span>
                  )}
                  <button
                    type="button"
                    className="remove-photo"
                    onClick={() => removeFile(i)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="message">
            Message{" "}
            <span className="optional">
              (optionnel, max {MAX_MESSAGE_LENGTH} caracteres)
            </span>
          </label>
          <textarea
            id="message"
            value={form.message}
            onChange={(e) => {
              if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                updateField("message", e.target.value);
              }
            }}
            placeholder="Racontez-nous l'histoire derriere ces photos..."
            rows={4}
          />
          <span className="char-count">
            {form.message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        </div>

        <div className="form-group consents">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.consentBrand}
              onChange={(e) => updateField("consentBrand", e.target.checked)}
            />
            <span>
              J'accepte que ces photos soient diffusées sur le site de la marque
              ou ses reseaux si l'opportunite se presente. *
            </span>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.consentAccount}
              onChange={(e) => updateField("consentAccount", e.target.checked)}
            />
            <span>
              J'accepte de lier mes photos à un compte Runes de Chene, me donnant acces a
              mes photos et l'application Carte, si celui-ci n'existe pas encore.
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="btn-primary btn-submit"
          disabled={!isValid()}
        >
          Envoyer mes photos
        </button>
      </form>
    </div>
  );
}
