using UnityEngine;

public class URLOpener : MonoBehaviour
{
    public string URL;
    public void Open()
    {
        Application.OpenURL(URL);
    }
}
